from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Auth Schemas
# -----------------------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: str
    role: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class UserRegister(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$", description="Valid email address")
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: Optional[str] = None
    department: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    department: Optional[str] = Field(default=None, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Categories & Locations
# -----------------------------------------------------------------------------
class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_name: Optional[str] = "box"

    class Config:
        from_attributes = True

class CampusLocationResponse(BaseModel):
    id: int
    name: str
    zone: str
    building: Optional[str] = None
    floor: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Lost Item Schemas
# -----------------------------------------------------------------------------
class LostItemCreate(BaseModel):
    category_id: int
    item_description: str = Field(..., min_length=5, description="Meaningful description of the lost item")
    approximate_location: str = Field(..., min_length=3, description="Last known or approximate location")
    location_id: Optional[int] = None
    lost_date_time: datetime
    lost_time_range: Optional[str] = None
    distinctive_details: Optional[str] = Field(default=None, description="Optional distinctive identifiers (stickers, scratches, marks)")
    brand: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    image_url: Optional[str] = None

class LostItemResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    location_id: Optional[int] = None
    approximate_location: str
    item_description: str
    distinctive_details: Optional[str] = None
    brand: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    lost_date_time: datetime
    lost_time_range: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    created_at: datetime
    user_name: Optional[str] = None
    category_name: Optional[str] = None
    location_name: Optional[str] = None

    class Config:
        from_attributes = True


class LostItemStatusUpdate(BaseModel):
    status: Literal["open", "claim_pending", "matched", "resolved", "cancelled"]
    reason: Optional[str] = Field(default=None, max_length=500)


# -----------------------------------------------------------------------------
# Found Item Schemas
# -----------------------------------------------------------------------------
class FoundItemCreate(BaseModel):
    category_id: int
    item_description: str = Field(..., min_length=5)
    found_location_description: str = Field(..., min_length=3)
    location_id: Optional[int] = None
    found_date_time: datetime
    storage_location: str = Field(..., min_length=2, description="Physical room, locker or bin designation in lost & found room")
    distinctive_details: Optional[str] = None
    brand: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    finder_name: Optional[str] = None
    finder_contact: Optional[str] = None
    image_url: Optional[str] = None

class FoundItemResponse(BaseModel):
    id: int
    recorded_by_staff_id: int
    category_id: int
    location_id: Optional[int] = None
    found_location_description: str
    item_description: str
    distinctive_details: Optional[str] = None
    brand: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    found_date_time: datetime
    physical_custody_confirmed: bool
    storage_location: Optional[str] = None # Masked for non-staff in certain views
    finder_name: Optional[str] = None
    finder_contact: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    created_at: datetime
    category_name: Optional[str] = None
    location_name: Optional[str] = None
    staff_name: Optional[str] = None

    class Config:
        from_attributes = True


class FoundItemStatusUpdate(BaseModel):
    status: Literal["in_custody", "claim_pending", "awaiting_handover", "returned", "disposed"]
    reason: Optional[str] = Field(default=None, max_length=500)


# -----------------------------------------------------------------------------
# Matching Schemas
# -----------------------------------------------------------------------------
class MatchCandidateResponse(BaseModel):
    id: int
    lost_item_id: int
    found_item_id: int
    match_score: float
    semantic_score: float
    structured_score: float
    keyword_score: float
    match_reasons: Optional[str] = None
    staff_review_status: str
    staff_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    lost_item_description: Optional[str] = None
    found_item_description: Optional[str] = None
    lost_owner_name: Optional[str] = None
    lost_location: Optional[str] = None
    found_location: Optional[str] = None
    category_name: Optional[str] = None
    storage_location: Optional[str] = None

    class Config:
        from_attributes = True

class MatchCandidateReview(BaseModel):
    staff_review_status: str = Field(..., pattern="^(relevant|rejected|investigating)$")
    staff_notes: Optional[str] = None

# -----------------------------------------------------------------------------
# Claims Schemas
# -----------------------------------------------------------------------------
class ClaimCreate(BaseModel):
    found_item_id: int
    lost_item_id: Optional[int] = None
    claim_description: str = Field(..., min_length=10, description="Detailed explanation of why this item belongs to you")
    proof_evidence_notes: str = Field(..., min_length=5, description="Supporting evidence (receipts, serials, photos, purchase date)")
    distinctive_proof: Optional[str] = Field(default=None, description="Hidden distinctive marks, lock screen wallpaper, specific internal contents")

class ClaimReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|info_requested)$")
    staff_decision_notes: str = Field(..., min_length=5, description="Detailed reasoning for approval, rejection, or info request")

class ClaimResponse(BaseModel):
    id: int
    found_item_id: int
    claimant_user_id: int
    lost_item_id: Optional[int] = None
    claim_description: str
    proof_evidence_notes: str
    distinctive_proof: Optional[str] = None
    status: str
    staff_reviewer_id: Optional[int] = None
    staff_decision_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    claimant_name: Optional[str] = None
    claimant_email: Optional[str] = None
    found_item_description: Optional[str] = None
    storage_location: Optional[str] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Handover Schemas
# -----------------------------------------------------------------------------
class HandoverCreate(BaseModel):
    claim_id: int
    recipient_id_type: str = Field(..., min_length=3, description="Identity card type e.g. Student ID Card, Driving License")
    recipient_id_number: str = Field(..., min_length=3, description="Identification document number verified by staff")
    handover_notes: Optional[str] = None
    recipient_signature_acknowledged: bool = True

class HandoverResponse(BaseModel):
    id: int
    claim_id: int
    found_item_id: int
    recipient_user_id: int
    staff_id: int
    handover_date_time: datetime
    recipient_id_type: str
    recipient_id_number: str
    handover_notes: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    staff_name: Optional[str] = None
    item_description: Optional[str] = None

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Notifications & Audit Schemas
# -----------------------------------------------------------------------------
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    reference_entity: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    table_name: str
    record_id: int
    action: str
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    changed_by_user_id: Optional[int] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class StatusHistoryResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    old_status: Optional[str] = None
    new_status: str
    changed_by_user_id: Optional[int] = None
    change_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# -----------------------------------------------------------------------------
# Dashboard & Evaluation Summary
# -----------------------------------------------------------------------------
class DashboardOverview(BaseModel):
    total_lost_items: int
    open_lost_items: int
    resolved_lost_items: int
    total_found_items: int
    items_in_custody: int
    items_awaiting_handover: int
    items_returned: int
    total_claims: int
    pending_claims: int
    approved_claims: int
    completed_handovers: int
    total_match_candidates: int
    high_confidence_matches: int
