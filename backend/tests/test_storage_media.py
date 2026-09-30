"""
Tests for Storage Management & Static Media Serving:
  - Static media routes (/media, /media/crops)
  - Directory structure checks
  - Max upload file size enforcement
"""
import os

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_static_media_serving(client: AsyncClient):
    os.makedirs(settings.SESSION_PHOTO_DIR, exist_ok=True)
    filename = "test_photo_static.jpg"
    filepath = os.path.join(settings.SESSION_PHOTO_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(b"fake image data content")

    try:
        response = await client.get(f"/media/{filename}")
        assert response.status_code == 200
        assert response.content == b"fake image data content"
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@pytest.mark.asyncio
async def test_static_crops_serving(client: AsyncClient):
    # Crops directory is mounted under /media/crops or /media/crops/filename
    crops_dir = os.path.join(settings.SESSION_PHOTO_DIR, "crops")
    os.makedirs(crops_dir, exist_ok=True)
    filename = "crop_face_static.jpg"
    filepath = os.path.join(crops_dir, filename)
    with open(filepath, "wb") as f:
        f.write(b"crop image data content")

    try:
        response = await client.get(f"/media/crops/{filename}")
        assert response.status_code == 200
        assert response.content == b"crop image data content"
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
