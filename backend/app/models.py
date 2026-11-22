from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from backend.app.database import Base
from backend.app.config import settings

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(20), nullable=False, index=True) # 'student', 'staff', 'admin'
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint("role IN ('student', 'staff', 'admin')", name="check_user_role"),
    )

    # Relationships
    lost_reports = relationship("LostItem", back_populates="user", cascade="all, delete-orphan")
    found_records = relationship("FoundItem", back_populates="recorded_by_staff")
    claims = relationship("Claim", back_populates="claimant", foreign_keys="Claim.claimant_user_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon_name = Column(String(50), default="box")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    lost_items = relationship("LostItem", back_populates="category")
    found_items = relationship("FoundItem", back_populates="category")


class CampusLocation(Base):
    __tablename__ = "campus_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    zone = Column(String(60), nullable=False, index=True)
    building = Column(String(100), nullable=True)
    floor = Column(String(30), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    lost_items = relationship("LostItem", back_populates="location")
    found_items = relationship("FoundItem", back_populates="location")


class LostItem(Base):
    __tablename__ = "lost_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("campus_locations.id", ondelete="SET NULL"), nullable=True)
    approximate_location = Column(String(200), nullable=False)
    item_description = Column(Text, nullable=False)
    distinctive_details = Column(Text, nullable=True)
    brand = Column(String(80), nullable=True)
    primary_color = Column(String(40), nullable=True)
    secondary_color = Column(String(40), nullable=True)
    lost_date_time = Column(DateTime(timezone=True), nullable=False, index=True)
    lost_time_range = Column(String(50), nullable=True)
    status = Column(String(30), default="open", nullable=False, index=True)
    image_url = Column(String(500), nullable=True)
    embedding = Column(Vector(settings.EMBEDDING_DIM), nullable=True)
    embedding_model = Column(String(100), default=settings.EMBEDDING_MODEL, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'claim_pending', 'matched', 'resolved', 'cancelled')",
            name="check_lost_item_status"
        ),
    )

    user = relationship("User", back_populates="lost_reports")
    category = relationship("Category", back_populates="lost_items")
    location = relationship("CampusLocation", back_populates="lost_items")
    matches = relationship("MatchCandidate", back_populates="lost_item", cascade="all, delete-orphan")


class FoundItem(Base):
    __tablename__ = "found_items"

    id = Column(Integer, primary_key=True, index=True)
    recorded_by_staff_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("campus_locations.id", ondelete="SET NULL"), nullable=True)
    found_location_description = Column(String(200), nullable=False)
    item_description = Column(Text, nullable=False)
    distinctive_details = Column(Text, nullable=True)
    brand = Column(String(80), nullable=True)
    primary_color = Column(String(40), nullable=True)
    secondary_color = Column(String(40), nullable=True)
    found_date_time = Column(DateTime(timezone=True), nullable=False, index=True)
    physical_custody_confirmed = Column(Boolean, default=True, nullable=False)
    storage_location = Column(String(120), nullable=False, index=True) # e.g. Room 104, Locker 3-B
    finder_name = Column(String(120), nullable=True)
    finder_contact = Column(String(100), nullable=True)
    status = Column(String(30), default="in_custody", nullable=False, index=True)
    image_url = Column(String(500), nullable=True)
    embedding = Column(Vector(settings.EMBEDDING_DIM), nullable=True)
    embedding_model = Column(String(100), default=settings.EMBEDDING_MODEL, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_custody', 'claim_pending', 'awaiting_handover', 'returned', 'disposed')",
            name="check_found_item_status"
        ),
    )

    recorded_by_staff = relationship("User", back_populates="found_records")
    category = relationship("Category", back_populates="found_items")
    location = relationship("CampusLocation", back_populates="found_items")
    matches = relationship("MatchCandidate", back_populates="found_item", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="found_item")


class MatchCandidate(Base):
    __tablename__ = "match_candidates"

    id = Column(Integer, primary_key=True, index=True)
    lost_item_id = Column(Integer, ForeignKey("lost_items.id", ondelete="CASCADE"), nullable=False, index=True)
    found_item_id = Column(Integer, ForeignKey("found_items.id", ondelete="CASCADE"), nullable=False, index=True)
    match_score = Column(Numeric(5, 2), nullable=False, index=True)
    semantic_score = Column(Numeric(5, 2), default=0.0)
    structured_score = Column(Numeric(5, 2), default=0.0)
    keyword_score = Column(Numeric(5, 2), default=0.0)
    match_reasons = Column(Text, nullable=True)
    staff_review_status = Column(String(30), default="unreviewed", nullable=False) # 'unreviewed', 'relevant', 'rejected', 'investigating'
    staff_notes = Column(Text, nullable=True)
    reviewed_by_staff_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("lost_item_id", "found_item_id", name="uq_lost_found_match"),
        CheckConstraint("match_score >= 0 AND match_score <= 100", name="check_match_score_range"),
        CheckConstraint(
            "staff_review_status IN ('unreviewed', 'relevant', 'rejected', 'investigating')",
            name="check_staff_review_status"
        ),
    )

    lost_item = relationship("LostItem", back_populates="matches")
    found_item = relationship("FoundItem", back_populates="matches")
    reviewed_by_staff = relationship("User")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    found_item_id = Column(Integer, ForeignKey("found_items.id", ondelete="RESTRICT"), nullable=False, index=True)
    claimant_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lost_item_id = Column(Integer, ForeignKey("lost_items.id", ondelete="SET NULL"), nullable=True)
    claim_description = Column(Text, nullable=False)
    proof_evidence_notes = Column(Text, nullable=False)
    distinctive_proof = Column(Text, nullable=True) # Sensitive details for verification
    status = Column(String(30), default="submitted", nullable=False, index=True)
    staff_reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    staff_decision_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'withdrawn')",
            name="check_claim_status"
        ),
    )

    found_item = relationship("FoundItem", back_populates="claims")
    claimant = relationship("User", foreign_keys=[claimant_user_id], back_populates="claims")
    lost_item = relationship("LostItem")
    staff_reviewer = relationship("User", foreign_keys=[staff_reviewer_id])
    handover = relationship("Handover", uselist=False, back_populates="claim")


class Handover(Base):
    __tablename__ = "handovers"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="RESTRICT"), unique=True, nullable=False)
    found_item_id = Column(Integer, ForeignKey("found_items.id", ondelete="RESTRICT"), unique=True, nullable=False, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    handover_date_time = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    recipient_id_type = Column(String(60), nullable=False) # e.g. 'Student ID Card'
    recipient_id_number = Column(String(80), nullable=False)
    handover_notes = Column(Text, nullable=True)
    recipient_signature_acknowledged = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    claim = relationship("Claim", back_populates="handover")
    found_item = relationship("FoundItem")
    recipient = relationship("User", foreign_keys=[recipient_user_id])
    staff = relationship("User", foreign_keys=[staff_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(40), nullable=False) # 'match_found', 'claim_update', 'handover_ready', 'general'
    is_read = Column(Boolean, default=False, nullable=False)
    reference_entity = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(60), nullable=False, index=True)
    record_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False) # 'INSERT', 'UPDATE', 'DELETE'
    old_values = Column(Text, nullable=True)
    new_values = Column(Text, nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint("action IN ('INSERT', 'UPDATE', 'DELETE')", name="check_audit_action"),
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(30), nullable=False) # 'lost_item', 'found_item', 'claim'
    entity_id = Column(Integer, nullable=False)
    old_status = Column(String(40), nullable=True)
    new_status = Column(String(40), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    change_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint("entity_type IN ('lost_item', 'found_item', 'claim')", name="check_status_history_entity"),
    )


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(128), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), default=utc_now)


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False)
    reset_token = Column(String(128), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

