import json
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.auth import (
    check_rate_limit,
    create_access_token,
    decode_token_payload,
    get_current_user,
    get_password_hash,
    oauth2_scheme,
    verify_password,
)
from backend.app.database import get_db
from backend.app.models import AuditLog, PasswordResetRequest, RevokedToken, User
from backend.app.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    Token,
    UserProfileUpdate,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db), request: Request = None):
    client_ip = request.client.host if (request and request.client) else "direct"
    check_rate_limit(f"register:{client_ip}", max_requests=10, window_seconds=60)

    normalized_email = user_in.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to complete registration with the provided email address.",
        )

    # Security: Public registration strictly assigns 'student' role.
    # Staff and admin roles can only be granted by an existing administrator.
    user = User(
        email=normalized_email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        role="student",
        phone=user_in.phone,
        department=user_in.department,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        table_name="users",
        record_id=user.id,
        action="INSERT",
        new_values=json.dumps({"email": user.email, "role": user.role}),
        changed_by_user_id=user.id,
        ip_address=client_ip,
    )
    db.add(audit)
    db.commit()

    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    request: Request = None,
):
    client_ip = request.client.host if (request and request.client) else "direct"
    check_rate_limit(f"login:{client_ip}", max_requests=20, window_seconds=60)

    normalized_email = form_data.username.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact the Lost & Found office.",
        )

    token = create_access_token(data={"sub": user.email, "role": user.role, "user_id": user.id})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


@router.post("/logout")
def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_token_payload(token)
        jti = payload.get("jti")
        exp_ts = payload.get("exp")
        expires_at = (
            datetime.fromtimestamp(exp_ts, tz=timezone.utc)
            if exp_ts
            else datetime.now(timezone.utc) + timedelta(hours=8)
        )
        if jti:
            existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
            if not existing:
                db.add(RevokedToken(jti=jti, user_id=current_user.id, expires_at=expires_at))
                db.commit()
    except Exception:
        pass
    return {"status": "logged_out", "message": "Session terminated securely."}


@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Prototype password reset request endpoint.
    Never reveals whether an email address is registered (enumeration-safe).
    """
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"forgot:{client_ip}", max_requests=10, window_seconds=60)

    normalized_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if user:
        reset_req = PasswordResetRequest(
            email=normalized_email,
            reset_token=str(uuid.uuid4()),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            used=False,
        )
        db.add(reset_req)
        db.commit()

    return {
        "status": "accepted",
        "message": (
            "If an account matches that campus email, a password reset request has been logged. "
            "In this local university prototype without an external SMTP relay, please contact the "
            "Lost & Found Administrator to reset credentials."
        ),
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if profile_in.full_name is not None:
        current_user.full_name = profile_in.full_name.strip()
    if profile_in.phone is not None:
        current_user.phone = profile_in.phone.strip() or None
    if profile_in.department is not None:
        current_user.department = profile_in.department.strip() or None

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    pw_in: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(pw_in.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    current_user.password_hash = get_password_hash(pw_in.new_password)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}
