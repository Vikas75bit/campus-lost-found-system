import pytest
from fastapi import HTTPException
from backend.app.schemas import ClaimCreate, ClaimReview, HandoverCreate
from backend.app.routers.claims import submit_claim, review_claim
from backend.app.routers.handovers import record_handover
from backend.app.models import FoundItem, LostItem

def test_student_can_submit_claim(db, student_user):
    claim_in = ClaimCreate(
        found_item_id=1,
        lost_item_id=1,
        claim_description="This Dell laptop belongs to me. Left on Library 2nd floor window desk.",
        proof_evidence_notes="I have the original purchase receipt from Dell and serial number in email.",
        distinctive_proof="The GitHub Octocat sticker on the lid has a small tear on the left ear."
    )
    claim = submit_claim(claim_in, db, student_user)
    assert claim.id is not None
    assert claim.status == "submitted"
    assert claim.found_item_id == 1

def test_cannot_claim_returned_item(db, student_user):
    # Found Item #4 is marked 'returned' in seed data
    claim_in = ClaimCreate(
        found_item_id=4,
        claim_description="Attempting to claim already returned backpack",
        proof_evidence_notes="Some notes"
    )
    with pytest.raises(HTTPException) as exc_info:
        submit_claim(claim_in, db, student_user)
    assert exc_info.value.status_code == 400
    assert "no longer in custody" in exc_info.value.detail

def test_staff_claim_approval_leaves_item_awaiting_handover(db, staff_user):
    # Review Claim #2
    review_in = ClaimReview(
        status="approved",
        staff_decision_notes="Student identity and distinctive proof validated during in-person check."
    )
    reviewed = review_claim(2, review_in, db, staff_user)
    assert reviewed.status == "approved"

    # Found item #2 MUST be in 'awaiting_handover' state, NOT 'returned'!
    found_item = db.query(FoundItem).filter(FoundItem.id == 2).first()
    assert found_item.status == "awaiting_handover"

def test_staff_completes_handover_and_resolves_case(db, staff_user):
    # 1. Staff first approves Claim #2
    review_in = ClaimReview(
        status="approved",
        staff_decision_notes="Student identity and distinctive proof validated during in-person check."
    )
    review_claim(2, review_in, db, staff_user)

    # 2. Perform handover for approved Claim #2
    handover_in = HandoverCreate(
        claim_id=2,
        recipient_id_type="University Student ID Card",
        recipient_id_number="STU-2023-CS-98231",
        handover_notes="Physical handover completed. Recipient verified ID and signed receipt register.",
        recipient_signature_acknowledged=True
    )
    res = record_handover(handover_in, db, staff_user)
    assert res.id is not None
    assert res.recipient_id_number == "STU-2023-CS-98231"

    # Found Item #2 MUST now be 'returned'
    found_item = db.query(FoundItem).filter(FoundItem.id == 2).first()
    assert found_item.status == "returned"

    # Associated Lost Item #2 MUST now be 'resolved'
    lost_item = db.query(LostItem).filter(LostItem.id == 2).first()
    assert lost_item.status == "resolved"
