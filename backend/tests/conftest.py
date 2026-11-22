import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models import User
from backend.app.seed import seed_database

# Run tests against real PostgreSQL + pgvector database
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://lostfound_user:lostfound_password@localhost:5432/lost_found_test_db",
)

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture()
def student_user(db):
    return db.query(User).filter(User.email == "student1@campus.edu").first()


@pytest.fixture()
def student2_user(db):
    return db.query(User).filter(User.email == "student2@campus.edu").first()


@pytest.fixture()
def staff_user(db):
    return db.query(User).filter(User.email == "staff@campus.edu").first()


@pytest.fixture()
def admin_user(db):
    return db.query(User).filter(User.email == "admin@campus.edu").first()
