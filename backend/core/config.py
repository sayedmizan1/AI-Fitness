from pydantic_settings import BaseSettings
from functools import lru_cache
import os


def _find_env_file() -> list[str]:
    """Check backend/ first, then project root for .env file."""
    backend_dir = os.path.dirname(__file__)  # core/
    backend_root = os.path.abspath(os.path.join(backend_dir, ".."))  # backend/
    project_root = os.path.abspath(os.path.join(backend_dir, "..", ".."))  # project root
    candidates = [
        os.path.join(backend_root, ".env"),
        os.path.join(project_root, ".env"),
    ]
    return [p for p in candidates if os.path.exists(p)]


class Settings(BaseSettings):
    # AI APIs
    google_api_key: str = ""
    groq_api_key: str = ""

    # Auth
    secret_key: str = "change_me_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # Database
    database_url: str = "sqlite+aiosqlite:///./fitmentor.db"

    # ChromaDB
    chroma_persist_dir: str = "./chroma_db"

    # App
    app_name: str = "FitMentor AI"
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = _find_env_file()
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
