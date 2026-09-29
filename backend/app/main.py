"""
FastAPI application entrypoint.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, classes, sessions, students
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

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
app.mount("/media", StaticFiles(directory=settings.SESSION_PHOTO_DIR), name="media")
app.mount("/media/crops", StaticFiles(directory=settings.CROP_DIR), name="media-crops")


@app.get("/health")
async def health():
    return {"status": "ok"}
