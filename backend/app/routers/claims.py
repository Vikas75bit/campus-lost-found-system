from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import Claim, FoundItem, LostItem, User, Notification, StatusHistory, AuditLog
from backend.app.schemas import ClaimCreate, ClaimReview, ClaimResponse
from backend.app.auth import get_current_user, require_role

router = APIRouter(prefix="/claims", tags=["Ownership Claims & Verification"])

@router.post("", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
def submit_claim(
    claim_in: ClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Validate target found item
    found_item = db.query(FoundItem).filter(FoundItem.id == claim_in.found_item_id).first()
    if not found_item:
        raise HTTPException(status_code=404, detail="Found item not found.")

    # Prevent claims on returned or disposed items
    if found_item.status in ["returned", "disposed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit claim: item is already {found_item.status} and no longer in custody."
        )

    # Prevent duplicate active claims by same user on same found item
    existing = db.query(Claim).filter(
        Claim.found_item_id == found_item.id,
        Claim.claimant_user_id == current_user.id,
        Claim.status.in_(["submitted", "under_review", "info_requested", "approved"])
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active claim on this item.")

    claim = Claim(
        found_item_id=found_item.id,
        claimant_user_id=current_user.id,
        lost_item_id=claim_in.lost_item_id,
        claim_description=claim_in.claim_description,
        proof_evidence_notes=claim_in.proof_evidence_notes,
        distinctive_proof=claim_in.distinctive_proof,
        status="submitted"
    )
    db.add(claim)

    # Update found item status to claim_pending if currently in_custody
    if found_item.status == "in_custody":
        found_item.status = "claim_pending"

    db.commit()
    db.refresh(claim)

    # Record in status history
    history = StatusHistory(
        entity_type="claim",
        entity_id=claim.id,
        old_status=None,
        new_status="submitted",
        changed_by_user_id=current_user.id,
        change_reason="Claim submitted by student"
    )
    db.add(history)

    # Notify staff members
    staff_users = db.query(User).filter(User.role.in_(["staff", "admin"])).all()
    for s in staff_users:
        notif = Notification(
            user_id=s.id,
            title="New Ownership Claim Received",
            message=f"User {current_user.full_name} submitted a claim for Found Item #{found_item.id} ({found_item.item_description[:30]}...).",
            notification_type="claim_update",
            reference_entity="claims",
            reference_id=claim.id
        )
        db.add(notif)

    db.commit()

    return ClaimResponse(
        id=claim.id,
        found_item_id=claim.found_item_id,
        claimant_user_id=claim.claimant_user_id,
        lost_item_id=claim.lost_item_id,
        claim_description=claim.claim_description,
        proof_evidence_notes=claim.proof_evidence_notes,
        distinctive_proof=claim.distinctive_proof,
        status=claim.status,
        created_at=claim.created_at,
        claimant_name=current_user.full_name,
        claimant_email=current_user.email,
        found_item_description=found_item.item_description,
        storage_location=found_item.storage_location if current_user.role in ["staff", "admin"] else None
    )

@router.get("", response_model=List[ClaimResponse])
def get_claims(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Claim)
    if current_user.role == "student":
        query = query.filter(Claim.claimant_user_id == current_user.id)
    elif status_filter:
        query = query.filter(Claim.status == status_filter)

    claims = query.order_by(Claim.created_at.desc()).all()
    results = []
    is_staff = current_user.role in ["staff", "admin"]

    for c in claims:
        results.append(ClaimResponse(
            id=c.id,
            found_item_id=c.found_item_id,
            claimant_user_id=c.claimant_user_id,
            lost_item_id=c.lost_item_id,
            claim_description=c.claim_description,
            proof_evidence_notes=c.proof_evidence_notes,
            distinctive_proof=c.distinctive_proof if is_staff or c.claimant_user_id == current_user.id else None,
            status=c.status,
            staff_reviewer_id=c.staff_reviewer_id,
            staff_decision_notes=c.staff_decision_notes,
            reviewed_at=c.reviewed_at,
            created_at=c.created_at,
            claimant_name=c.claimant.full_name if c.claimant else None,
            claimant_email=c.claimant.email if c.claimant and is_staff else None,
            found_item_description=c.found_item.item_description if c.found_item else None,
            storage_location=c.found_item.storage_location if c.found_item and is_staff else None
        ))
    return results

@router.get("/{claim_id}", response_model=ClaimResponse)
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Claim).filter(Claim.id == claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found.")

    is_staff = current_user.role in ["staff", "admin"]
    if current_user.role == "student" and c.claimant_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to view another student's claim.")

    return ClaimResponse(
        id=c.id,
        found_item_id=c.found_item_id,
        claimant_user_id=c.claimant_user_id,
        lost_item_id=c.lost_item_id,
        claim_description=c.claim_description,
        proof_evidence_notes=c.proof_evidence_notes,
        distinctive_proof=c.distinctive_proof,
        status=c.status,
        staff_reviewer_id=c.staff_reviewer_id,
        staff_decision_notes=c.staff_decision_notes,
        reviewed_at=c.reviewed_at,
        created_at=c.created_at,
        claimant_name=c.claimant.full_name if c.claimant else None,
        claimant_email=c.claimant.email if c.claimant and is_staff else None,
        found_item_description=c.found_item.item_description if c.found_item else None,
        storage_location=c.found_item.storage_location if c.found_item and is_staff else None
    )

@router.put("/{claim_id}/review", response_model=ClaimResponse)
def review_claim(
    claim_id: int,
    review_in: ClaimReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    old_status = claim.status
    claim.status = review_in.status
    claim.staff_reviewer_id = current_user.id
    claim.staff_decision_notes = review_in.staff_decision_notes
    claim.reviewed_at = datetime.now(timezone.utc)

    found_item = claim.found_item

    # Record status transition in status history
    history = StatusHistory(
        entity_type="claim",
        entity_id=claim.id,
        old_status=old_status,
        new_status=review_in.status,
        changed_by_user_id=current_user.id,
        change_reason=review_in.staff_decision_notes
    )
    db.add(history)

    # Workflow branching
    if review_in.status == "approved":
        # CRITICAL: A claim approval moves found item to 'awaiting_handover', NEVER 'returned'!
        found_item.status = "awaiting_handover"
        
        # Notify claimant
        notif = Notification(
            user_id=claim.claimant_user_id,
            title="Claim Approved - Awaiting Handover",
            message=f"Your claim on {found_item.item_description[:30]} was APPROVED by staff! Please visit the Lost & Found Room with photo ID to collect your item.",
            notification_type="claim_update",
            reference_entity="claims",
            reference_id=claim.id
        )
        db.add(notif)

    elif review_in.status == "rejected":
        # Check if other active claims exist on this item; if none, revert to in_custody
        other_active = db.query(Claim).filter(
            Claim.found_item_id == found_item.id,
            Claim.id != claim.id,
            Claim.status.in_(["submitted", "under_review", "info_requested"])
        ).first()
        if not other_active:
            found_item.status = "in_custody"

        notif = Notification(
            user_id=claim.claimant_user_id,
            title="Claim Update - Rejected",
            message=f"Your claim on {found_item.item_description[:30]} was not approved. Staff Notes: {review_in.staff_decision_notes}",
            notification_type="claim_update",
            reference_entity="claims",
            reference_id=claim.id
        )
        db.add(notif)

    elif review_in.status == "info_requested":
        notif = Notification(
            user_id=claim.claimant_user_id,
            title="Additional Evidence Requested",
            message=f"Staff requested additional evidence for your claim on {found_item.item_description[:30]}. Details: {review_in.staff_decision_notes}",
            notification_type="claim_update",
            reference_entity="claims",
            reference_id=claim.id
        )
        db.add(notif)

    db.commit()
    db.refresh(claim)

    return ClaimResponse(
        id=claim.id,
        found_item_id=claim.found_item_id,
        claimant_user_id=claim.claimant_user_id,
        lost_item_id=claim.lost_item_id,
        claim_description=claim.claim_description,
        proof_evidence_notes=claim.proof_evidence_notes,
        distinctive_proof=claim.distinctive_proof,
        status=claim.status,
        staff_reviewer_id=claim.staff_reviewer_id,
        staff_decision_notes=claim.staff_decision_notes,
        reviewed_at=claim.reviewed_at,
        created_at=claim.created_at,
        claimant_name=claim.claimant.full_name if claim.claimant else None,
        claimant_email=claim.claimant.email if claim.claimant else None,
        found_item_description=found_item.item_description,
        storage_location=found_item.storage_location
    )

