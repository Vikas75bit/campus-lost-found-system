import pytest
from datetime import datetime, timezone
from fastapi import HTTPException
from pydantic import ValidationError
from backend.app.schemas import LostItemCreate, FoundItemCreate
from backend.app.routers.lost_items import create_lost_item, get_lost_items, get_lost_item, update_lost_item
from backend.app.routers.found_items import record_found_item, get_found_items, get_found_item

def test_valid_lost_report_submission(db, student_user):
    item_in = LostItemCreate(
        category_id=1,
        item_description="Apple iPad Pro 11-inch Space Grey with white pencil",
        approximate_location="Central Library 3rd floor quiet area",
        lost_date_time=datetime.now(timezone.utc),
        distinctive_details="Corner dent near power button",
        brand="Apple",
        primary_color="Grey"
    )
    res = create_lost_item(item_in, db, student_user)
    assert res.id is not None
    assert res.item_description == item_in.item_description
    assert res.status == "open"
    assert res.user_name == student_user.full_name

def test_missing_required_fields_rejected():
    with pytest.raises(ValidationError):
        # Missing approximate_location and lost_date_time
        LostItemCreate(
            category_id=1,
            item_description="Laptop"
        )

def test_optional_distinctive_details_accepted_empty(db, student_user):
    item_in = LostItemCreate(
        category_id=4,
        item_description="Brass key attached to blue spiral coil ring",
        approximate_location="Hostel cafeteria walkway",
        lost_date_time=datetime.now(timezone.utc),
        distinctive_details=None, # Optional empty
        brand=None
    )
    res = create_lost_item(item_in, db, student_user)
    assert res.id is not None
    assert res.distinctive_details is None

def test_student_cannot_modify_another_students_report(db, student2_user):
    # Student 2 tries to modify Lost Item #1 (owned by Student 1 Alex Rivera)
    update_in = LostItemCreate(
        category_id=1,
        item_description="Malicious edit attempt by unauthorized student",
        approximate_location="Nowhere",
        lost_date_time=datetime.now(timezone.utc)
    )
    with pytest.raises(HTTPException) as exc_info:
        update_lost_item(1, update_in, db, student2_user)
    assert exc_info.value.status_code == 403
    assert "Cannot edit another user's report" in exc_info.value.detail

def test_student_cannot_view_restricted_details_of_other_report(db, student2_user):
    with pytest.raises(HTTPException) as exc_info:
        get_lost_item(1, db, student2_user)
    assert exc_info.value.status_code == 403
    assert "Unauthorized" in exc_info.value.detail

def test_staff_can_record_found_item_custody(db, staff_user):
    item_in = FoundItemCreate(
        category_id=1,
        item_description="Apple iPad Pro found under library study chair",
        found_location_description="Library 3rd floor",
        found_date_time=datetime.now(timezone.utc),
        storage_location="Locker Bin C-03",
        distinctive_details="Dent near power switch",
        brand="Apple",
        primary_color="Grey"
    )
    res = record_found_item(item_in, db, staff_user)
    assert res.id is not None
    assert res.storage_location == "Locker Bin C-03"
    assert res.physical_custody_confirmed is True
    assert res.status == "in_custody"

def test_student_found_item_browsing_masks_storage_location(db, student_user, staff_user):
    # Student view
    student_items = get_found_items(None, None, None, db, student_user)
    for itm in student_items:
        assert itm.storage_location is None # Masked
        assert itm.finder_name is None      # Masked

    # Staff view
    staff_items = get_found_items(None, None, None, db, staff_user)
    assert any(itm.storage_location is not None for itm in staff_items)


def test_admin_update_lost_item_status_reflects_across_users(db, admin_user, student_user, staff_user):
    from backend.app.models import AuditLog, Notification, StatusHistory
    from backend.app.routers.lost_items import update_lost_item_status
    from backend.app.schemas import LostItemStatusUpdate

    created = create_lost_item(
        LostItemCreate(
            category_id=1,
            item_description="Silver Casio scientific calculator with cracked cover",
            approximate_location="Lecture Hall 101",
            lost_date_time=datetime.now(timezone.utc),
        ),
        db,
        student_user,
    )
    assert created.status == "open"

    updated = update_lost_item_status(
        created.id,
        LostItemStatusUpdate(status="resolved", reason="Returned after manual verification"),
        db,
        admin_user,
    )
    assert updated.status == "resolved"

    # Visible to both the student owner and staff/admin queries
    student_visible = get_lost_item(created.id, db, student_user)
    assert student_visible.status == "resolved"
    staff_list = get_lost_items(None, None, None, db, staff_user)
    assert any(r.id == created.id and r.status == "resolved" for r in staff_list)

    # Audit log, status history, and reporter notification recorded
    hist = (
        db.query(StatusHistory)
        .filter(
            StatusHistory.entity_type == "lost_item",
            StatusHistory.entity_id == created.id,
            StatusHistory.new_status == "resolved",
        )
        .first()
    )
    assert hist is not None
    assert hist.old_status == "open"
    assert "manual verification" in (hist.change_reason or "")

    audit = (
        db.query(AuditLog)
        .filter(AuditLog.table_name == "lost_items", AuditLog.record_id == created.id, AuditLog.action == "UPDATE")
        .first()
    )
    assert audit is not None

    notif = (
        db.query(Notification)
        .filter(
            Notification.user_id == student_user.id,
            Notification.reference_entity == "lost_items",
            Notification.reference_id == created.id,
        )
        .first()
    )
    assert notif is not None
    assert "resolved" in notif.message.lower()

    # Repeating identical status is a no-op (does not duplicate history entries)
    history_count_before = (
        db.query(StatusHistory)
        .filter(StatusHistory.entity_type == "lost_item", StatusHistory.entity_id == created.id)
        .count()
    )
    noop = update_lost_item_status(
        created.id,
        LostItemStatusUpdate(status="resolved", reason="Duplicate click"),
        db,
        admin_user,
    )
    assert noop.status == "resolved"
    assert (
        db.query(StatusHistory)
        .filter(StatusHistory.entity_type == "lost_item", StatusHistory.entity_id == created.id)
        .count()
        == history_count_before
    )


def test_admin_update_found_item_status_reflects_across_users(db, admin_user, staff_user, student_user):
    from backend.app.models import AuditLog, Notification, StatusHistory
    from backend.app.routers.claims import submit_claim
    from backend.app.routers.found_items import update_found_item_status
    from backend.app.schemas import ClaimCreate, FoundItemStatusUpdate

    created = record_found_item(
        FoundItemCreate(
            category_id=2,
            item_description="Navy Nike drawstring gym sack",
            found_location_description="Sports Pavilion Locker Area",
            found_date_time=datetime.now(timezone.utc),
            storage_location="Shelf D-08",
        ),
        db,
        staff_user,
    )
    assert created.status == "in_custody"

    # Student submits an active claim -> status becomes claim_pending
    claim = submit_claim(
        ClaimCreate(
            found_item_id=created.id,
            claim_description="Navy drawstring gym bag lost after evening basketball",
            proof_evidence_notes="Has torn inner mesh pocket",
        ),
        db,
        student_user,
    )
    assert claim.found_item_id == created.id

    # Admin marks found item as disposed -> hidden from student browse list, visible to staff
    disposed = update_found_item_status(
        created.id,
        FoundItemStatusUpdate(status="disposed", reason="Unclaimed beyond retention window"),
        db,
        admin_user,
    )
    assert disposed.status == "disposed"

    student_browse = get_found_items(None, None, None, db, student_user)
    assert all(itm.id != created.id for itm in student_browse)

    staff_browse = get_found_items(None, None, None, db, staff_user)
    assert any(itm.id == created.id and itm.status == "disposed" for itm in staff_browse)

    # Admin restores to in_custody -> visible again to students
    restored = update_found_item_status(
        created.id,
        FoundItemStatusUpdate(status="in_custody", reason="Item located in annex storage"),
        db,
        admin_user,
    )
    assert restored.status == "in_custody"
    student_browse_after = get_found_items(None, None, None, db, student_user)
    assert any(itm.id == created.id and itm.status == "in_custody" for itm in student_browse_after)

    # StatusHistory, AuditLog, and notifications to recording staff + active claimant exist
    assert (
        db.query(StatusHistory)
        .filter(StatusHistory.entity_type == "found_item", StatusHistory.entity_id == created.id)
        .count()
        >= 3
    )
    assert (
        db.query(AuditLog)
        .filter(AuditLog.table_name == "found_items", AuditLog.record_id == created.id, AuditLog.action == "UPDATE")
        .count()
        >= 2
    )
    staff_notif = (
        db.query(Notification)
        .filter(
            Notification.user_id == staff_user.id,
            Notification.reference_entity == "found_items",
            Notification.reference_id == created.id,
        )
        .first()
    )
    student_notif = (
        db.query(Notification)
        .filter(
            Notification.user_id == student_user.id,
            Notification.reference_entity == "found_items",
            Notification.reference_id == created.id,
        )
        .first()
    )
    assert staff_notif is not None
    assert student_notif is not None


def test_non_admin_cannot_update_report_status(db, student_user, staff_user, admin_user):
    from fastapi.testclient import TestClient
    from backend.app.auth import create_access_token
    from backend.app.database import get_db
    from backend.app.main import app

    def _auth_headers(user):
        token = create_access_token(
            data={"sub": user.email, "role": user.role, "user_id": user.id}
        )
        return {"Authorization": f"Bearer {token}"}

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        for non_admin in (student_user, staff_user):
            r_lost = client.put(
                "/api/lost-items/1/status",
                json={"status": "resolved"},
                headers=_auth_headers(non_admin),
            )
            assert r_lost.status_code == 403

            r_found = client.put(
                "/api/found-items/1/status",
                json={"status": "returned"},
                headers=_auth_headers(non_admin),
            )
            assert r_found.status_code == 403

        # Admin passes RBAC, invalid enum value is rejected with 422
        r_invalid = client.put(
            "/api/lost-items/1/status",
            json={"status": "invalid_enum_value"},
            headers=_auth_headers(admin_user),
        )
        assert r_invalid.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
