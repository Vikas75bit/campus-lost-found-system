from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import Handover, Claim, FoundItem, LostItem, User, Notification, StatusHistory, AuditLog
from backend.app.schemas import HandoverCreate, HandoverResponse
from backend.app.auth import get_current_user, require_role

router = APIRouter(prefix="/handovers", tags=["Physical Handover & Resolution"])

@router.post("", response_model=HandoverResponse, status_code=status.HTTP_201_CREATED)
def record_handover(
    handover_in: HandoverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    """
    Executes an atomic handover operation:
    1. Validates claim is approved.
    2. Validates found item is awaiting handover.
    3. Records physical recipient ID verification.
    4. Transitions found item to 'returned'.
    5. Transitions associated lost item to 'resolved'.
    6. Creates status histories and notification.
    Case is resolved ONLY HERE!
    """
    claim = db.query(Claim).filter(Claim.id == handover_in.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    if claim.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record handover: Claim #{claim.id} is in status '{claim.status}', but must be 'approved'."
        )

    found_item = db.query(FoundItem).filter(FoundItem.id == claim.found_item_id).first()
    if not found_item:
        raise HTTPException(status_code=404, detail="Found item record missing.")

    if found_item.status != "awaiting_handover":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record handover: Found item #{found_item.id} is in status '{found_item.status}', must be 'awaiting_handover'."
        )

    # Check for existing handover
    existing_handover = db.query(Handover).filter(Handover.claim_id == claim.id).first()
    if existing_handover:
        raise HTTPException(status_code=400, detail="Handover record already exists for this claim.")

    # Begin atomic transaction
    try:
        handover = Handover(
            claim_id=claim.id,
            found_item_id=found_item.id,
            recipient_user_id=claim.claimant_user_id,
            staff_id=current_user.id,
            handover_date_time=datetime.now(timezone.utc),
            recipient_id_type=handover_in.recipient_id_type,
            recipient_id_number=handover_in.recipient_id_number,
            handover_notes=handover_in.handover_notes,
            recipient_signature_acknowledged=handover_in.recipient_signature_acknowledged
        )
        db.add(handover)

        # 1. Update found item status to 'returned'
        found_item.status = "returned"
        db.add(StatusHistory(
            entity_type="found_item",
            entity_id=found_item.id,
            old_status="awaiting_handover",
            new_status="returned",
            changed_by_user_id=current_user.id,
            change_reason=f"Handed over to recipient ID {handover_in.recipient_id_number}"
        ))

        # 2. If an associated lost item exists, update its status to 'resolved'
        if claim.lost_item_id:
            lost_item = db.query(LostItem).filter(LostItem.id == claim.lost_item_id).first()
            if lost_item:
                old_lost_status = lost_item.status
                lost_item.status = "resolved"
                db.add(StatusHistory(
                    entity_type="lost_item",
                    entity_id=lost_item.id,
                    old_status=old_lost_status,
                    new_status="resolved",
                    changed_by_user_id=current_user.id,
                    change_reason="Associated found item physically returned to verified claimant"
                ))

        # 3. Notification for recipient
        db.add(Notification(
            user_id=claim.claimant_user_id,
            title="Item Handover Completed",
            message=f"Physical handover for your item '{found_item.item_description[:30]}' is completed. Case resolved.",
            notification_type="handover_ready",
            reference_entity="handovers",
            reference_id=claim.id
        ))

        # 4. Audit log entry
        db.add(AuditLog(
            table_name="handovers",
            record_id=claim.id,
            action="INSERT",
            new_values=f'{{"recipient_id": {claim.claimant_user_id}, "id_type": "{handover_in.recipient_id_type}", "staff_id": {current_user.id}}}',
            changed_by_user_id=current_user.id
        ))

        db.commit()
        db.refresh(handover)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Handover transaction failed: {str(e)}")

    return HandoverResponse(
        id=handover.id,
        claim_id=handover.claim_id,
        found_item_id=handover.found_item_id,
        recipient_user_id=handover.recipient_user_id,
        staff_id=handover.staff_id,
        handover_date_time=handover.handover_date_time,
        recipient_id_type=handover.recipient_id_type,
        recipient_id_number=handover.recipient_id_number,
        handover_notes=handover.handover_notes,
        recipient_name=claim.claimant.full_name if claim.claimant else None,
        recipient_email=claim.claimant.email if claim.claimant else None,
        staff_name=current_user.full_name,
        item_description=found_item.item_description
    )

@router.get("", response_model=List[HandoverResponse])
def get_handovers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    handovers = db.query(Handover).order_by(Handover.handover_date_time.desc()).all()
    results = []
    for h in handovers:
        results.append(HandoverResponse(
            id=h.id,
            claim_id=h.claim_id,
            found_item_id=h.found_item_id,
            recipient_user_id=h.recipient_user_id,
            staff_id=h.staff_id,
            handover_date_time=h.handover_date_time,
            recipient_id_type=h.recipient_id_type,
            recipient_id_number=h.recipient_id_number,
            handover_notes=h.handover_notes,
            recipient_name=h.recipient.full_name if h.recipient else None,
            recipient_email=h.recipient.email if h.recipient else None,
            staff_name=h.staff.full_name if h.staff else None,
            item_description=h.found_item.item_description if h.found_item else None
        ))
    return results

