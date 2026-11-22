from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import Base, SessionLocal, engine, ensure_pgvector_extension, get_db
from backend.app.routers import (
    admin,
    auth,
    claims,
    evaluation,
    found_items,
    handovers,
    lost_items,
    matching,
    notifications,
)
from backend.app.seed import seed_database


def ensure_pgvector_indexes() -> None:
    """Create HNSW vector indexes and GIN full-text search indexes idempotently."""
    ddl_statements = [
        "CREATE INDEX IF NOT EXISTS idx_lost_items_embedding_hnsw ON lost_items USING hnsw (embedding vector_cosine_ops)",
        "CREATE INDEX IF NOT EXISTS idx_found_items_embedding_hnsw ON found_items USING hnsw (embedding vector_cosine_ops)",
        (
            "CREATE INDEX IF NOT EXISTS idx_lost_items_fts ON lost_items USING GIN ("
            "to_tsvector('english', coalesce(item_description, '') || ' ' || "
            "coalesce(distinctive_details, '') || ' ' || coalesce(brand, '') || ' ' || "
            "coalesce(approximate_location, '')))"
        ),
        (
            "CREATE INDEX IF NOT EXISTS idx_found_items_fts ON found_items USING GIN ("
            "to_tsvector('english', coalesce(item_description, '') || ' ' || "
            "coalesce(distinctive_details, '') || ' ' || coalesce(brand, '') || ' ' || "
            "coalesce(found_location_description, '')))"
        ),
    ]
    with engine.begin() as conn:
        for stmt in ddl_statements:
            conn.execute(text(stmt))


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_pgvector_extension()
    Base.metadata.create_all(bind=engine)
    ensure_pgvector_indexes()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "University Campus Lost & Found Intelligence System powered by PostgreSQL + pgvector "
        "and hybrid candidate matching."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(lost_items.router, prefix=settings.API_V1_STR)
app.include_router(found_items.router, prefix=settings.API_V1_STR)
app.include_router(matching.router, prefix=settings.API_V1_STR)
app.include_router(claims.router, prefix=settings.API_V1_STR)
app.include_router(handovers.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(evaluation.router, prefix=settings.API_V1_STR)


@app.get("/api/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    pgvec = db.execute(
        text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
    ).scalar()
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": "postgresql",
        "pgvector": pgvec or "not_installed",
        "embedding_model": settings.EMBEDDING_MODEL,
    }


@app.get("/", tags=["Root"])
def root_info():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_docs": "/docs",
        "health": "/api/health",
        "frontend_note": "Use the Next.js App Router frontend (default http://localhost:3000).",
    }
