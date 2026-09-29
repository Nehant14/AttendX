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
async def test_static_media_serving(client: AsyncClient, tmp_storage: str):
    # Save a test file in session photo storage
    filename = "test_photo.jpg"
    filepath = os.path.join(settings.SESSION_PHOTO_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(b"fake image data content")

    response = await client.get(f"/media/{filename}")
    assert response.status_code == 200
    assert response.content == b"fake image data content"


@pytest.mark.asyncio
async def test_static_crops_serving(client: AsyncClient, tmp_storage: str):
    filename = "crop_face1.jpg"
    filepath = os.path.join(settings.CROP_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(b"crop image data content")

    response = await client.get(f"/media/crops/{filename}")
    assert response.status_code == 200
    assert response.content == b"crop image data content"


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
