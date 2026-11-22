import os
from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "University Lost & Found Intelligence System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"

    # Mandatory PostgreSQL + pgvector database URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://lostfound_user:lostfound_password@localhost:5432/lost_found_db",
    )

    # JWT Auth Configuration
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "dev_only_campus_lost_found_secret_key_change_in_prod_2026",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # CORS Origins (Next.js App Router frontend)
    CORS_ORIGINS: List[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]

    # Embedding Model Configuration (all-MiniLM-L6-v2 -> 384 dimensions)
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = 384

    # Server Binding
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
