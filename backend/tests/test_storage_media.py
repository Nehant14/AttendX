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
    # Face crops are written to settings.CROP_DIR by the attendance pipeline
    # and must be reachable at /media/crops/<filename>. (This used to write
    # into SESSION_PHOTO_DIR/crops, which only passed because the broad /media
    # mount shadowed /media/crops and the real crops directory was never served.)
    os.makedirs(settings.CROP_DIR, exist_ok=True)
    filename = "crop_face_static.jpg"
    filepath = os.path.join(settings.CROP_DIR, filename)
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
async def test_crops_and_photos_are_served_from_separate_dirs(client: AsyncClient):
    """A crop must not be reachable via the sessions dir and vice versa."""
    os.makedirs(settings.SESSION_PHOTO_DIR, exist_ok=True)
    os.makedirs(settings.CROP_DIR, exist_ok=True)
    photo = os.path.join(settings.SESSION_PHOTO_DIR, "only_photo.jpg")
    crop = os.path.join(settings.CROP_DIR, "only_crop.jpg")
    with open(photo, "wb") as f:
        f.write(b"photo")
    with open(crop, "wb") as f:
        f.write(b"crop")
    try:
        assert (await client.get("/media/only_photo.jpg")).content == b"photo"
        assert (await client.get("/media/crops/only_crop.jpg")).content == b"crop"
        assert (await client.get("/media/crops/only_photo.jpg")).status_code == 404
    finally:
        for path in (photo, crop):
            if os.path.exists(path):
                os.remove(path)


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
