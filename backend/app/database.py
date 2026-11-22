import atexit
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

_wsl_keepalive: subprocess.Popen[bytes] | None = None

db_url = settings.DATABASE_URL
if not db_url.startswith(("postgresql://", "postgresql+psycopg2://")):
    raise RuntimeError(
        "PostgreSQL with pgvector is required as the primary database. "
        f"Unsupported DATABASE_URL scheme: {db_url}"
    )
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _is_tcp_open(host: str, port: int, timeout: float = 1.0) -> bool:
    """Return True if a TCP connection to (host, port) succeeds."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def ensure_local_postgres_running(force_start: bool = False) -> bool:
    """Ensure local PostgreSQL is reachable; start WSL2 Ubuntu PostgreSQL if needed on Windows."""
    global _wsl_keepalive
    parsed = urlparse(settings.DATABASE_URL)
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432

    if host not in {"localhost", "127.0.0.1", "::1"}:
        return False
    if not force_start and _is_tcp_open(host, port):
        return True

    if sys.platform == "win32" and shutil.which("wsl"):
        print(f"PostgreSQL is not reachable on {host}:{port}. Starting WSL2 (Ubuntu) PostgreSQL service...")
        start_proc = subprocess.run(
            ["wsl", "-d", "Ubuntu", "-u", "root", "--", "service", "postgresql", "start"],
            capture_output=True,
            text=True,
            check=False,
        )
        if start_proc.returncode == 0:
            if _wsl_keepalive is None or _wsl_keepalive.poll() is not None:
                _wsl_keepalive = subprocess.Popen(
                    ["wsl", "-d", "Ubuntu", "-u", "root", "--", "tail", "-f", "/dev/null"],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                atexit.register(
                    lambda: _wsl_keepalive.terminate()
                    if _wsl_keepalive is not None and _wsl_keepalive.poll() is None
                    else None
                )

            for _ in range(20):
                if _is_tcp_open(host, port, timeout=0.5):
                    print(f"PostgreSQL is ready on {host}:{port}.")
                    return True
                time.sleep(0.5)

    return False


def ensure_pgvector_extension() -> None:
    """Ensure pgvector extension is enabled in PostgreSQL before table creation."""
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except OperationalError:
        if ensure_local_postgres_running(force_start=True):
            engine.dispose()
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        else:
            raise


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
