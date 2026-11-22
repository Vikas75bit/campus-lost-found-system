import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from backend.app.models import User, LostItem, Category, StatusHistory, Claim

def test_fk_constraint_enforced_on_invalid_category(db):
    # Attempt to insert a lost item with non-existent category_id = 9999
    invalid_item = LostItem(
        user_id=1,
        category_id=9999,
        approximate_location="Test",
        item_description="Test Item with invalid FK",
        lost_date_time=datetime.now(timezone.utc),
        status="open"
    )
    db.add(invalid_item)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

def test_check_constraint_on_invalid_user_role(db):
    # Role check constraint: role IN ('student', 'staff', 'admin')
    invalid_user = User(
        email="hacker@campus.edu",
        password_hash="anyhash",
        full_name="Invalid Role User",
        role="super_hacker", # Violates check constraint
        is_active=True
    )
    db.add(invalid_user)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

def test_check_constraint_on_invalid_lost_status(db):
    # Lost status check constraint: status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled')
    invalid_item = LostItem(
        user_id=1,
        category_id=1,
        approximate_location="Test Location",
        item_description="Test Item Description",
        lost_date_time=datetime.now(timezone.utc),
        status="invalid_custom_status"
    )
    db.add(invalid_item)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

def test_unique_constraint_on_email(db):
    # admin@campus.edu already exists in seed data
    duplicate_user = User(
        email="admin@campus.edu",
        password_hash="duplicatehash",
        full_name="Duplicate Admin",
        role="admin",
        is_active=True
    )
    db.add(duplicate_user)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

def test_status_history_retained(db):
    records = db.query(StatusHistory).all()
    assert len(records) > 0
    first = records[0]
    assert first.entity_type in ["lost_item", "found_item", "claim"]
    assert first.new_status is not None
