"""
Tests for ML helper components:
  - FaceDetector tile generation, IoU, and NMS merging
  - Embedder cosine similarity and crop embedding
  - Anti-spoofing / liveness preprocessing & inference handling
"""
import os

import numpy as np
import pytest

from app.ml.detector import Face, FaceDetector, _iou, _nms_merge, get_detector
from app.ml.embedder import cosine_similarity, embed_face_crop
from app.ml.liveness import _preprocess, is_live
from tests.conftest import create_unit_embedding


# --- Detector Tiling & NMS Tests ---
def test_tile_bounds_small_image(monkeypatch: pytest.MonkeyPatch):
    # Image smaller than tile size should return single full tile
    dummy_detector = object.__new__(FaceDetector)
    bounds = FaceDetector._tile_bounds(dummy_detector, width=800, height=600)
    assert len(bounds) == 1
    assert bounds[0] == (0, 0, 800, 600)


def test_tile_bounds_large_image(monkeypatch: pytest.MonkeyPatch):
    dummy_detector = object.__new__(FaceDetector)
    # Image 2000x2000 with default tile size 1280
    bounds = FaceDetector._tile_bounds(dummy_detector, width=2000, height=2000)
    assert len(bounds) > 1
    for x0, y0, x1, y1 in bounds:
        assert x0 >= 0 and y0 >= 0
        assert x1 <= 2000 and y1 <= 2000
        assert (x1 - x0) <= 1280 and (y1 - y0) <= 1280


def test_iou_calculation():
    box1 = (0.0, 0.0, 10.0, 10.0)  # Area 100
    box2 = (0.0, 0.0, 10.0, 10.0)  # Identical
    assert _iou(box1, box2) == 1.0

    box3 = (20.0, 20.0, 10.0, 10.0)  # Disjoint
    assert _iou(box1, box3) == 0.0

    box4 = (5.0, 0.0, 10.0, 10.0)  # 50% overlap horizontally -> Inter=50, Union=150
    assert abs(_iou(box1, box4) - (50.0 / 150.0)) < 1e-4


def test_nms_merge():
    emb = np.array(create_unit_embedding(1), dtype=np.float32)
    face_high = Face(bbox=(10, 10, 50, 50), det_score=0.95, embedding=emb)
    face_low = Face(bbox=(12, 12, 50, 50), det_score=0.80, embedding=emb)  # High overlap with face_high
    face_distinct = Face(bbox=(200, 200, 50, 50), det_score=0.90, embedding=emb)

    merged = _nms_merge([face_low, face_high, face_distinct], iou_thresh=0.4)
    assert len(merged) == 2
    assert merged[0] == face_high  # Higher score kept
    assert merged[1] == face_distinct


def test_detector_singleton():
    # Calling get_detector twice returns same instance
    det1 = get_detector()
    det2 = get_detector()
    assert det1 is det2


# --- Embedder Tests ---
def test_cosine_similarity():
    v1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    v2 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    v3 = np.array([0.0, 1.0, 0.0], dtype=np.float32)

    assert cosine_similarity(v1, v2) == 1.0
    assert cosine_similarity(v1, v3) == 0.0


def test_embed_face_crop_success(mock_detector):
    emb = np.array(create_unit_embedding(5), dtype=np.float32)
    face = Face(bbox=(0, 0, 50, 50), det_score=0.9, embedding=emb)
    mock_detector(faces=[face])

    crop = np.zeros((100, 100, 3), dtype=np.uint8)
    extracted = embed_face_crop(crop)
    assert extracted is not None
    assert np.array_equal(extracted, emb)


def test_embed_face_crop_none_when_empty(mock_detector):
    mock_detector(faces=[])
    crop = np.zeros((100, 100, 3), dtype=np.uint8)
    assert embed_face_crop(crop) is None


# --- Liveness Anti-Spoofing Tests ---
def test_liveness_preprocess_shape():
    crop = np.zeros((120, 120, 3), dtype=np.uint8)
    processed = _preprocess(crop)
    # Output format: (batch, channels, height, width) = (1, 3, 80, 80)
    assert processed.shape == (1, 3, 80, 80)
    assert processed.dtype == np.float32
    assert processed.max() <= 1.0


def test_liveness_missing_model_file(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.ml.liveness.MODEL_PATH", "/nonexistent/model.onnx")
    crop = np.zeros((80, 80, 3), dtype=np.uint8)
    with pytest.raises(FileNotFoundError, match="Liveness model not found"):
        is_live(crop)
