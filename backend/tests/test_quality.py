"""
Unit tests for the quality gate (app/ml/quality.py).
"""
import numpy as np

from app.ml.quality import crop_face, passes_quality


def _solid_image(h, w, blurry=False):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    if not blurry:
        # A checkerboard pattern gives a high Laplacian variance (sharp).
        img[::2, ::2] = 255
    return img


def test_rejects_too_small_face():
    crop = _solid_image(20, 20)
    ok, reason = passes_quality(crop, min_size=40, min_blur=0)
    assert not ok
    assert reason == "face_too_small"


def test_rejects_blurry_face():
    crop = _solid_image(100, 100, blurry=True)
    ok, reason = passes_quality(crop, min_size=40, min_blur=1000)
    assert not ok
    assert reason == "too_blurry"


def test_accepts_sharp_adequately_sized_face():
    crop = _solid_image(100, 100, blurry=False)
    ok, reason = passes_quality(crop, min_size=40, min_blur=10)
    assert ok
    assert reason is None


def test_crop_face_respects_bounds():
    image = np.zeros((200, 200, 3), dtype=np.uint8)
    crop = crop_face(image, bbox=(10, 10, 50, 50), pad=0.1)
    assert crop.shape[0] > 0 and crop.shape[1] > 0
    assert crop.shape[0] <= 200 and crop.shape[1] <= 200


def test_crop_face_handles_edge_of_image():
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    # bbox extends past the image bounds; should be clipped, not error.
    crop = crop_face(image, bbox=(80, 80, 50, 50), pad=0.2)
    assert crop.shape[0] > 0 and crop.shape[1] > 0
