import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import LostItem, FoundItem, Category, CampusLocation, MatchCandidate, Notification, StatusHistory, AuditLog, User
from backend.app.schemas import LostItemCreate, LostItemResponse, LostItemStatusUpdate
from backend.app.auth import get_current_user, require_role
from backend.app.config import settings
from backend.app.matching.hybrid import compute_hybrid_match
from backend.app.matching.semantic import query_pgvector_candidates, semantic_engine

router = APIRouter(prefix="/lost-items", tags=["Lost Item Reports"])

@router.post("", response_model=LostItemResponse, status_code=status.HTTP_201_CREATED)
def create_lost_item(
    item_in: LostItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # LR-05: Validate category
    cat = db.query(Category).filter(Category.id == item_in.category_id, Category.is_active == True).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid or inactive item category.")

    # Validate location if provided
    if item_in.location_id:
        loc = db.query(CampusLocation).filter(CampusLocation.id == item_in.location_id).first()
        if not loc:
            raise HTTPException(status_code=400, detail="Invalid campus location ID.")

    lost_item = LostItem(
        user_id=current_user.id,
        category_id=item_in.category_id,
        location_id=item_in.location_id,
        approximate_location=item_in.approximate_location,
        item_description=item_in.item_description,
        distinctive_details=item_in.distinctive_details, # Prompted but optional
        brand=item_in.brand,
        primary_color=item_in.primary_color,
        secondary_color=item_in.secondary_color,
        lost_date_time=item_in.lost_date_time,
        lost_time_range=item_in.lost_time_range,
        status="open",
        image_url=item_in.image_url
    )
    lost_item.embedding = semantic_engine.encode_item(lost_item)
    lost_item.embedding_model = settings.EMBEDDING_MODEL
    db.add(lost_item)
    db.commit()
    db.refresh(lost_item)

    # Record in status history & audit log
    history = StatusHistory(
        entity_type="lost_item",
        entity_id=lost_item.id,
        old_status=None,
        new_status="open",
        changed_by_user_id=current_user.id,
        change_reason="Initial report submission"
    )
    db.add(history)
    db.commit()

    # Discover candidate matches via pgvector cosine retrieval + hybrid reranking
    pgvec_hits = query_pgvector_candidates(
        db=db,
        query_embedding=lost_item.embedding,
        category_id=lost_item.category_id,
        limit=15,
    )
    candidate_found_items = [found for found, _ in pgvec_hits]
    if not candidate_found_items:
        candidate_found_items = db.query(FoundItem).filter(
            FoundItem.status.in_(["in_custody", "claim_pending"]),
            FoundItem.category_id == lost_item.category_id,
        ).all()

    for found in candidate_found_items:
        score, sem_score, struct_score, kw_score, reasons_json = compute_hybrid_match(lost_item, found)
        if score >= 45.0: # Candidate discovery threshold
            candidate = MatchCandidate(
                lost_item_id=lost_item.id,
                found_item_id=found.id,
                match_score=score,
                semantic_score=sem_score,
                structured_score=struct_score,
                keyword_score=kw_score,
                match_reasons=reasons_json,
                staff_review_status="unreviewed"
            )
            db.add(candidate)
            # Notify student of potential candidate
            notif = Notification(
                user_id=current_user.id,
                title="Potential Match Discovered",
                message=f"A potential match (similarity score: {score}%) was found for your report: {lost_item.item_description[:40]}...",
                notification_type="match_found",
                reference_entity="match_candidates"
            )
            db.add(notif)

    db.commit()

    return LostItemResponse(
        id=lost_item.id,
        user_id=lost_item.user_id,
        category_id=lost_item.category_id,
        location_id=lost_item.location_id,
        approximate_location=lost_item.approximate_location,
        item_description=lost_item.item_description,
        distinctive_details=lost_item.distinctive_details,
        brand=lost_item.brand,
        primary_color=lost_item.primary_color,
        secondary_color=lost_item.secondary_color,
        lost_date_time=lost_item.lost_date_time,
        lost_time_range=lost_item.lost_time_range,
        status=lost_item.status,
        image_url=lost_item.image_url,
        created_at=lost_item.created_at,
        user_name=current_user.full_name,
        category_name=cat.name,
        location_name=loc.name if item_in.location_id and loc else None
    )

@router.get("", response_model=List[LostItemResponse])
def get_lost_items(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(LostItem)
    
    # LR-11 & LR-12: Students see their own reports. Staff and admins can view all.
    if current_user.role == "student":
        query = query.filter(LostItem.user_id == current_user.id)
    
    if status_filter:
        query = query.filter(LostItem.status == status_filter)
    if category_id:
        query = query.filter(LostItem.category_id == category_id)
    if search:
        query = query.filter(
            (LostItem.item_description.ilike(f"%{search}%")) |
            (LostItem.approximate_location.ilike(f"%{search}%")) |
            (LostItem.brand.ilike(f"%{search}%"))
        )

    items = query.order_by(LostItem.created_at.desc()).all()
    results = []
    for item in items:
        results.append(LostItemResponse(
            id=item.id,
            user_id=item.user_id,
            category_id=item.category_id,
            location_id=item.location_id,
            approximate_location=item.approximate_location,
            item_description=item.item_description,
            distinctive_details=item.distinctive_details,
            brand=item.brand,
            primary_color=item.primary_color,
            secondary_color=item.secondary_color,
            lost_date_time=item.lost_date_time,
            lost_time_range=item.lost_time_range,
            status=item.status,
            image_url=item.image_url,
            created_at=item.created_at,
            user_name=item.user.full_name if item.user else None,
            category_name=item.category.name if item.category else None,
            location_name=item.location.name if item.location else None
        ))
    return results

@router.get("/{item_id}", response_model=LostItemResponse)
def get_lost_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Lost item report not found.")

    # Authorization: only report owner or staff/admin can inspect details
    if current_user.role == "student" and item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to view another student's restricted report.")

    return _serialize_lost_item(item)

@router.put("/{item_id}", response_model=LostItemResponse)
def update_lost_item(
    item_id: int,
    item_in: LostItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Lost item report not found.")

    # LR-12 & LR-13: Users cannot modify others' reports; staff/admin have controlled edit rights
    if current_user.role == "student":
        if item.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot edit another user's report.")
        if item.status != "open":
            raise HTTPException(status_code=400, detail="Cannot modify a report that is already under claim or resolved.")

    item.category_id = item_in.category_id
    item.location_id = item_in.location_id
    item.approximate_location = item_in.approximate_location
    item.item_description = item_in.item_description
    item.distinctive_details = item_in.distinctive_details
    item.brand = item_in.brand
    item.primary_color = item_in.primary_color
    item.secondary_color = item_in.secondary_color
    item.lost_date_time = item_in.lost_date_time
    item.lost_time_range = item_in.lost_time_range
    item.image_url = item_in.image_url
    item.embedding = semantic_engine.encode_item(item)
    item.embedding_model = settings.EMBEDDING_MODEL

    db.commit()
    db.refresh(item)
    return LostItemResponse(
        id=item.id,
        user_id=item.user_id,
        category_id=item.category_id,
        location_id=item.location_id,
        approximate_location=item.approximate_location,
        item_description=item.item_description,
        distinctive_details=item.distinctive_details,
        brand=item.brand,
        primary_color=item.primary_color,
        secondary_color=item.secondary_color,
        lost_date_time=item.lost_date_time,
        lost_time_range=item.lost_time_range,
        status=item.status,
        image_url=item.image_url,
        created_at=item.created_at,
        user_name=item.user.full_name if item.user else None,
        category_name=item.category.name if item.category else None,
        location_name=item.location.name if item.location else None
    )


def _serialize_lost_item(item: LostItem) -> LostItemResponse:
    """Build a LostItemResponse DTO from a LostItem ORM instance."""
    return LostItemResponse(
        id=item.id,
        user_id=item.user_id,
        category_id=item.category_id,
        location_id=item.location_id,
        approximate_location=item.approximate_location,
        item_description=item.item_description,
        distinctive_details=item.distinctive_details,
        brand=item.brand,
        primary_color=item.primary_color,
        secondary_color=item.secondary_color,
        lost_date_time=item.lost_date_time,
        lost_time_range=item.lost_time_range,
        status=item.status,
        image_url=item.image_url,
        created_at=item.created_at,
        user_name=item.user.full_name if item.user else None,
        category_name=item.category.name if item.category else None,
        location_name=item.location.name if item.location else None,
    )


@router.put("/{item_id}/status", response_model=LostItemResponse)
def update_lost_item_status(
    item_id: int,
    status_in: LostItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Allow an administrator to update a lost report status with full audit logging and reporter notification."""
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Lost item report not found.")

    if item.status == status_in.status:
        return _serialize_lost_item(item)

    old_status = item.status
    item.status = status_in.status
    reason_text = (status_in.reason or "").strip() or "Administrative status update"

    db.add(
        StatusHistory(
            entity_type="lost_item",
            entity_id=item.id,
            old_status=old_status,
            new_status=item.status,
            changed_by_user_id=current_user.id,
            change_reason=reason_text,
        )
    )
    db.add(
        AuditLog(
            table_name="lost_items",
            record_id=item.id,
            action="UPDATE",
            old_values=json.dumps({"status": old_status}),
            new_values=json.dumps({"status": item.status, "reason": reason_text}),
            changed_by_user_id=current_user.id,
        )
    )
    old_label = old_status.replace("_", " ")
    new_label = item.status.replace("_", " ")
    db.add(
        Notification(
            user_id=item.user_id,
            title="Lost Report Status Updated",
            message=(
                f"Your lost report #{item.id} ({item.item_description[:40]}) status was updated "
                f"from {old_label} to {new_label}. Reason: {reason_text}"
            ),
            notification_type="general",
            reference_entity="lost_items",
            reference_id=item.id,
        )
    )
    db.commit()
    db.refresh(item)
    return _serialize_lost_item(item)

