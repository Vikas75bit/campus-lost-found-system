import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import FoundItem, LostItem, Category, CampusLocation, Claim, MatchCandidate, Notification, StatusHistory, AuditLog, User
from backend.app.schemas import FoundItemCreate, FoundItemResponse, FoundItemStatusUpdate
from backend.app.auth import get_current_user, require_role
from backend.app.config import settings
from backend.app.matching.hybrid import compute_hybrid_match
from backend.app.matching.semantic import semantic_engine

router = APIRouter(prefix="/found-items", tags=["Found Items Custody Management"])

@router.post("", response_model=FoundItemResponse, status_code=status.HTTP_201_CREATED)
def record_found_item(
    item_in: FoundItemCreate,
    db: Session = Depends(get_db),
    # Only staff and admin can officially record items received into university custody
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    cat = db.query(Category).filter(Category.id == item_in.category_id, Category.is_active == True).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid item category.")

    loc = None
    if item_in.location_id:
        loc = db.query(CampusLocation).filter(CampusLocation.id == item_in.location_id).first()
        if not loc:
            raise HTTPException(status_code=400, detail="Invalid campus location ID.")

    found_item = FoundItem(
        recorded_by_staff_id=current_user.id,
        category_id=item_in.category_id,
        location_id=item_in.location_id,
        found_location_description=item_in.found_location_description,
        item_description=item_in.item_description,
        distinctive_details=item_in.distinctive_details,
        brand=item_in.brand,
        primary_color=item_in.primary_color,
        secondary_color=item_in.secondary_color,
        found_date_time=item_in.found_date_time,
        physical_custody_confirmed=True,
        storage_location=item_in.storage_location,
        finder_name=item_in.finder_name,
        finder_contact=item_in.finder_contact,
        status="in_custody",
        image_url=item_in.image_url
    )
    found_item.embedding = semantic_engine.encode_item(found_item)
    found_item.embedding_model = settings.EMBEDDING_MODEL
    db.add(found_item)
    db.commit()
    db.refresh(found_item)

    # Status history entry
    history = StatusHistory(
        entity_type="found_item",
        entity_id=found_item.id,
        old_status=None,
        new_status="in_custody",
        changed_by_user_id=current_user.id,
        change_reason=f"Recorded into physical custody at {found_item.storage_location}"
    )
    db.add(history)

    # Audit log
    audit = AuditLog(
        table_name="found_items",
        record_id=found_item.id,
        action="INSERT",
        new_values=f'{{"storage_location": "{found_item.storage_location}", "category_id": {found_item.category_id}}}',
        changed_by_user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    # Automatically scan open lost items for potential matches
    open_lost_reports = db.query(LostItem).filter(LostItem.status.in_(["open", "matched"])).all()
    for lost in open_lost_reports:
        score, sem_score, struct_score, kw_score, reasons_json = compute_hybrid_match(lost, found_item)
        if score >= 50.0:
            candidate = MatchCandidate(
                lost_item_id=lost.id,
                found_item_id=found_item.id,
                match_score=score,
                semantic_score=sem_score,
                structured_score=struct_score,
                keyword_score=kw_score,
                match_reasons=reasons_json,
                staff_review_status="unreviewed"
            )
            db.add(candidate)
            # Notify report owner
            notif = Notification(
                user_id=lost.user_id,
                title="Potential Match Discovered",
                message=f"Staff recorded a found item ({cat.name}) that resembles your reported item (Match score: {score}%).",
                notification_type="match_found",
                reference_entity="match_candidates"
            )
            db.add(notif)

    db.commit()

    return FoundItemResponse(
        id=found_item.id,
        recorded_by_staff_id=found_item.recorded_by_staff_id,
        category_id=found_item.category_id,
        location_id=found_item.location_id,
        found_location_description=found_item.found_location_description,
        item_description=found_item.item_description,
        distinctive_details=found_item.distinctive_details,
        brand=found_item.brand,
        primary_color=found_item.primary_color,
        secondary_color=found_item.secondary_color,
        found_date_time=found_item.found_date_time,
        physical_custody_confirmed=found_item.physical_custody_confirmed,
        storage_location=found_item.storage_location,
        finder_name=found_item.finder_name,
        finder_contact=found_item.finder_contact,
        status=found_item.status,
        image_url=found_item.image_url,
        created_at=found_item.created_at,
        category_name=cat.name,
        location_name=loc.name if loc else None,
        staff_name=current_user.full_name
    )

@router.get("", response_model=List[FoundItemResponse])
def get_found_items(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FoundItem)
    
    # Students should only browse available found items (in_custody or claim_pending)
    if current_user.role == "student":
        query = query.filter(FoundItem.status.in_(["in_custody", "claim_pending"]))
    elif status_filter:
        query = query.filter(FoundItem.status == status_filter)

    if category_id:
        query = query.filter(FoundItem.category_id == category_id)

    if search:
        query = query.filter(
            (FoundItem.item_description.ilike(f"%{search}%")) |
            (FoundItem.found_location_description.ilike(f"%{search}%")) |
            (FoundItem.brand.ilike(f"%{search}%"))
        )

    items = query.order_by(FoundItem.created_at.desc()).all()
    results = []
    is_staff_or_admin = current_user.role in ["staff", "admin"]

    for item in items:
        # Data masking: Students do not see internal custody bin / storage location or finder contact
        masked_storage = item.storage_location if is_staff_or_admin else None
        masked_finder = item.finder_name if is_staff_or_admin else None
        masked_contact = item.finder_contact if is_staff_or_admin else None

        results.append(FoundItemResponse(
            id=item.id,
            recorded_by_staff_id=item.recorded_by_staff_id,
            category_id=item.category_id,
            location_id=item.location_id,
            found_location_description=item.found_location_description,
            item_description=item.item_description,
            distinctive_details=item.distinctive_details if is_staff_or_admin else None,
            brand=item.brand,
            primary_color=item.primary_color,
            secondary_color=item.secondary_color,
            found_date_time=item.found_date_time,
            physical_custody_confirmed=item.physical_custody_confirmed,
            storage_location=masked_storage,
            finder_name=masked_finder,
            finder_contact=masked_contact,
            status=item.status,
            image_url=item.image_url,
            created_at=item.created_at,
            category_name=item.category.name if item.category else None,
            location_name=item.location.name if item.location else None,
            staff_name=item.recorded_by_staff.full_name if item.recorded_by_staff else None
        ))
    return results

@router.get("/{item_id}", response_model=FoundItemResponse)
def get_found_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Found item not found.")

    is_staff_or_admin = current_user.role in ["staff", "admin"]
    return FoundItemResponse(
        id=item.id,
        recorded_by_staff_id=item.recorded_by_staff_id,
        category_id=item.category_id,
        location_id=item.location_id,
        found_location_description=item.found_location_description,
        item_description=item.item_description,
        distinctive_details=item.distinctive_details if is_staff_or_admin else None,
        brand=item.brand,
        primary_color=item.primary_color,
        secondary_color=item.secondary_color,
        found_date_time=item.found_date_time,
        physical_custody_confirmed=item.physical_custody_confirmed,
        storage_location=item.storage_location if is_staff_or_admin else None,
        finder_name=item.finder_name if is_staff_or_admin else None,
        finder_contact=item.finder_contact if is_staff_or_admin else None,
        status=item.status,
        image_url=item.image_url,
        created_at=item.created_at,
        category_name=item.category.name if item.category else None,
        location_name=item.location.name if item.location else None,
        staff_name=item.recorded_by_staff.full_name if item.recorded_by_staff else None
    )


def _serialize_found_item(item: FoundItem, include_restricted: bool) -> FoundItemResponse:
    """Build a FoundItemResponse DTO with optional role-based field masking."""
    return FoundItemResponse(
        id=item.id,
        recorded_by_staff_id=item.recorded_by_staff_id,
        category_id=item.category_id,
        location_id=item.location_id,
        found_location_description=item.found_location_description,
        item_description=item.item_description,
        distinctive_details=item.distinctive_details if include_restricted else None,
        brand=item.brand,
        primary_color=item.primary_color,
        secondary_color=item.secondary_color,
        found_date_time=item.found_date_time,
        physical_custody_confirmed=item.physical_custody_confirmed,
        storage_location=item.storage_location if include_restricted else None,
        finder_name=item.finder_name if include_restricted else None,
        finder_contact=item.finder_contact if include_restricted else None,
        status=item.status,
        image_url=item.image_url,
        created_at=item.created_at,
        category_name=item.category.name if item.category else None,
        location_name=item.location.name if item.location else None,
        staff_name=item.recorded_by_staff.full_name if item.recorded_by_staff else None,
    )


@router.put("/{item_id}/status", response_model=FoundItemResponse)
def update_found_item_status(
    item_id: int,
    status_in: FoundItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Allow an administrator to update a found item custody status with audit logging and user notifications."""
    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Found item not found.")

    if item.status == status_in.status:
        return _serialize_found_item(item, include_restricted=True)

    old_status = item.status
    item.status = status_in.status
    reason_text = (status_in.reason or "").strip() or "Administrative status update"

    db.add(
        StatusHistory(
            entity_type="found_item",
            entity_id=item.id,
            old_status=old_status,
            new_status=item.status,
            changed_by_user_id=current_user.id,
            change_reason=reason_text,
        )
    )
    db.add(
        AuditLog(
            table_name="found_items",
            record_id=item.id,
            action="UPDATE",
            old_values=json.dumps({"status": old_status}),
            new_values=json.dumps({"status": item.status, "reason": reason_text}),
            changed_by_user_id=current_user.id,
        )
    )

    notify_user_ids: set[int] = set()
    if item.recorded_by_staff_id != current_user.id:
        notify_user_ids.add(item.recorded_by_staff_id)

    active_claims = (
        db.query(Claim)
        .filter(
            Claim.found_item_id == item.id,
            Claim.status.in_(["submitted", "under_review", "info_requested", "approved"]),
        )
        .all()
    )
    for claim in active_claims:
        if claim.claimant_user_id != current_user.id:
            notify_user_ids.add(claim.claimant_user_id)

    old_label = old_status.replace("_", " ")
    new_label = item.status.replace("_", " ")
    for uid in notify_user_ids:
        db.add(
            Notification(
                user_id=uid,
                title="Found Item Status Updated",
                message=(
                    f"Found item #{item.id} ({item.item_description[:40]}) status was updated "
                    f"from {old_label} to {new_label}. Reason: {reason_text}"
                ),
                notification_type="general",
                reference_entity="found_items",
                reference_id=item.id,
            )
        )

    db.commit()
    db.refresh(item)
    return _serialize_found_item(item, include_restricted=True)

