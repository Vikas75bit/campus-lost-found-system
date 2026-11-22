import pytest
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from backend.app.auth import verify_password, get_password_hash, create_access_token, require_role
from backend.app.routers.auth import login, register
from backend.app.schemas import UserRegister

def test_valid_login(db):
    form_data = OAuth2PasswordRequestForm(
        grant_type="password",
        username="student1@campus.edu",
        password="Student@123",
        scope="",
        client_id=None,
        client_secret=None
    )
    res = login(form_data, db)
    assert res.access_token is not None
    assert res.role == "student"
    assert res.email == "student1@campus.edu"

def test_invalid_login_wrong_password(db):
    form_data = OAuth2PasswordRequestForm(
        grant_type="password",
        username="student1@campus.edu",
        password="WrongPassword",
        scope="",
        client_id=None,
        client_secret=None
    )
    with pytest.raises(HTTPException) as exc_info:
        login(form_data, db)
    assert exc_info.value.status_code == 401
    assert "Invalid email or password" in exc_info.value.detail

def test_invalid_login_nonexistent_user(db):
    form_data = OAuth2PasswordRequestForm(
        grant_type="password",
        username="fake@campus.edu",
        password="AnyPassword",
        scope="",
        client_id=None,
        client_secret=None
    )
    with pytest.raises(HTTPException) as exc_info:
        login(form_data, db)
    assert exc_info.value.status_code == 401

def test_user_registration(db):
    reg_in = UserRegister(
        email="newstudent@campus.edu",
        password="Password@123",
        full_name="New Test Student",
        phone="+1-555-9999",
        department="Information Science"
    )
    new_user = register(reg_in, db)
    assert new_user.id is not None
    assert new_user.email == "newstudent@campus.edu"
    assert new_user.role == "student"
    assert verify_password("Password@123", new_user.password_hash)


def test_logout_revokes_token(db, student_user):
    from backend.app.auth import get_current_user
    from backend.app.routers.auth import logout

    token = create_access_token(
        data={"sub": student_user.email, "role": student_user.role, "user_id": student_user.id}
    )
    assert get_current_user(token=token, db=db).id == student_user.id

    logout(token=token, current_user=student_user, db=db)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(token=token, db=db)
    assert exc_info.value.status_code == 401

def test_role_restrictions(student_user, staff_user, admin_user):
    check_staff_or_admin = require_role(["staff", "admin"])
    check_admin_only = require_role(["admin"])

    # Staff passes staff_or_admin check
    assert check_staff_or_admin(staff_user) == staff_user
    # Admin passes staff_or_admin check
    assert check_staff_or_admin(admin_user) == admin_user
    # Student is blocked with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        check_staff_or_admin(student_user)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail

    # Staff is blocked from admin only
    with pytest.raises(HTTPException) as exc_info2:
        check_admin_only(staff_user)
    assert exc_info2.value.status_code == 403
