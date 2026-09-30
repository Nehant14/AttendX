"""
FastAPI application entrypoint.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, classes, sessions, students
from app.core.config import settings

logger = logging.getLogger("attendx")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    preload_task: asyncio.Task | None = None
    if settings.PRELOAD_MODELS:

        async def _preload() -> None:
            try:
                from app.ml.detector import get_detector

                # Runs in a thread so /health stays responsive while the model
                # downloads/loads. A request arriving meanwhile just waits on
                # the detector's lock instead of loading a second copy.
                await asyncio.to_thread(get_detector)
                logger.info("Face model loaded and ready")
            except Exception:  # noqa: BLE001
                logger.exception("Face model preload failed; it will be retried on first use")

        preload_task = asyncio.create_task(_preload())
    yield
    if preload_task is not None and not preload_task.done():
        preload_task.cancel()


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(students.router)
app.include_router(sessions.router)

# Serve session photos + face crops so the review UI can render them
# directly. In production these should be served from S3/MinIO instead
# (see the plan's Section 1: "Local disk (dev) -> S3/MinIO (prod)").
#
# NOTE on ordering: Starlette matches mounts in registration order and
# "/media" is a prefix of "/media/crops", so the more specific "/media/crops"
# mount MUST be registered first. Otherwise every request for a face crop is
# swallowed by the "/media" mount (which looks in the sessions directory) and
# returns 404.
#
# StaticFiles raises at import time if its directory is missing, which happens
# on a fresh Docker volume, so make sure both directories exist first.
for _directory in (settings.SESSION_PHOTO_DIR, settings.CROP_DIR, settings.ENROLLMENT_PHOTO_DIR):
    os.makedirs(_directory, exist_ok=True)

app.mount("/media/crops", StaticFiles(directory=settings.CROP_DIR), name="media-crops")
app.mount("/media", StaticFiles(directory=settings.SESSION_PHOTO_DIR), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}
