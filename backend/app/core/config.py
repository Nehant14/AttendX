"""
Application configuration, loaded from environment variables / .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "Face Attendance System"
    ENV: str = "development"
    DEBUG: bool = True

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://attendance:attendance@localhost:5432/attendance"

    # --- Auth ---
    SECRET_KEY: str = "change-me-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    # If false, processing runs synchronously in the request/response cycle
    # (useful for local dev without a running Celery worker / Redis).
    USE_CELERY: bool = False

    # --- Storage ---
    STORAGE_ROOT: str = "./storage"
    SESSION_PHOTO_DIR: str = "./storage/sessions"
    ENROLLMENT_PHOTO_DIR: str = "./storage/enrollment"
    CROP_DIR: str = "./storage/crops"
    MAX_UPLOAD_MB: int = 15

    # --- ML thresholds ---
    HIGH_MATCH_THRESHOLD: float = 0.65
    LOW_MATCH_THRESHOLD: float = 0.45
    MIN_FACE_SIZE_PX: int = 40
    MIN_BLUR_SCORE: float = 100.0
    DET_SIZE: int = 640
    # Load the face model in the background when the API boots, so the
    # (large, first-run) model download does not happen inside the first
    # enrollment request from the phone and cause a client timeout.
    PRELOAD_MODELS: bool = False
    MODEL_PACK: str = "buffalo_l"
    MODEL_VERSION: str = "buffalo_l-v1"

    # --- Tiled detection (for large group photos) ---
    ENABLE_TILED_DETECTION: bool = True
    TILE_SIZE: int = 1280
    TILE_OVERLAP: float = 0.2
    NMS_IOU_THRESHOLD: float = 0.4

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
