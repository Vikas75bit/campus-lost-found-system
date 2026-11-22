import sys
import uvicorn
from backend.app.config import settings
from backend.app.database import ensure_local_postgres_running


if __name__ == "__main__":
    if not ensure_local_postgres_running():
        print(
            "ERROR: Cannot connect to PostgreSQL. Start your PostgreSQL service "
            "(or WSL2 Ubuntu PostgreSQL via `wsl -d Ubuntu -u root -- service postgresql start`) "
            "and try again.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("================================================================")
    print(f" {settings.PROJECT_NAME}")
    print(f" Starting FastAPI server on http://{settings.HOST}:{settings.PORT}")
    print(f" API Documentation: http://{settings.HOST}:{settings.PORT}/docs")
    print("================================================================")
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=False)

