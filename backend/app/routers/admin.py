from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import get_db
from backend.app.models import (
    User, LostItem, FoundItem, Claim, Handover, MatchCandidate, AuditLog, StatusHistory, Category, CampusLocation
)
from backend.app.schemas import (
    UserResponse, AuditLogResponse, StatusHistoryResponse, DashboardOverview, CategoryResponse, CampusLocationResponse
)
from backend.app.auth import require_role

router = APIRouter(prefix="/admin", tags=["Administrator & Operations"])

@router.get("/dashboard-stats", response_model=DashboardOverview)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    total_lost = db.query(func.count(LostItem.id)).scalar() or 0
    open_lost = db.query(func.count(LostItem.id)).filter(LostItem.status == "open").scalar() or 0
    resolved_lost = db.query(func.count(LostItem.id)).filter(LostItem.status == "resolved").scalar() or 0

    total_found = db.query(func.count(FoundItem.id)).scalar() or 0
    in_custody = db.query(func.count(FoundItem.id)).filter(FoundItem.status == "in_custody").scalar() or 0
    awaiting_handover = db.query(func.count(FoundItem.id)).filter(FoundItem.status == "awaiting_handover").scalar() or 0
    returned_found = db.query(func.count(FoundItem.id)).filter(FoundItem.status == "returned").scalar() or 0

    total_claims = db.query(func.count(Claim.id)).scalar() or 0
    pending_claims = db.query(func.count(Claim.id)).filter(Claim.status.in_(["submitted", "under_review"])).scalar() or 0
    approved_claims = db.query(func.count(Claim.id)).filter(Claim.status == "approved").scalar() or 0
    completed_handovers = db.query(func.count(Handover.id)).scalar() or 0

    total_matches = db.query(func.count(MatchCandidate.id)).scalar() or 0
    high_conf_matches = db.query(func.count(MatchCandidate.id)).filter(MatchCandidate.match_score >= 80.0).scalar() or 0

    return DashboardOverview(
        total_lost_items=total_lost,
        open_lost_items=open_lost,
        resolved_lost_items=resolved_lost,
        total_found_items=total_found,
        items_in_custody=in_custody,
        items_awaiting_handover=awaiting_handover,
        items_returned=returned_found,
        total_claims=total_claims,
        pending_claims=pending_claims,
        approved_claims=approved_claims,
        completed_handovers=completed_handovers,
        total_match_candidates=total_matches,
        high_confidence_matches=high_conf_matches
    )

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    users = db.query(User).order_by(User.id.asc()).all()
    return users

@router.put("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    if role not in ["student", "staff", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be student, staff, or admin.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    old_role = user.role
    user.role = role

    audit = AuditLog(
        table_name="users",
        record_id=user.id,
        action="UPDATE",
        old_values=f'{{"role": "{old_role}"}}',
        new_values=f'{{"role": "{role}"}}',
        changed_by_user_id=current_user.id
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs

@router.get("/status-history", response_model=List[StatusHistoryResponse])
def get_status_history(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "admin"]))
):
    history = db.query(StatusHistory).order_by(StatusHistory.created_at.desc()).limit(limit).all()
    return history

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).filter(Category.is_active == True).order_by(Category.name.asc()).all()
    return cats

@router.get("/locations", response_model=List[CampusLocationResponse])
def get_locations(db: Session = Depends(get_db)):
    locs = db.query(CampusLocation).filter(CampusLocation.is_active == True).order_by(CampusLocation.zone.asc(), CampusLocation.name.asc()).all()
    return locs

