"""
Embedding extraction.

InsightFace's FaceAnalysis.get() (used in detector.py) already returns a
512-d, L2-normalized ArcFace embedding per detected face via
`.normed_embedding` — so most of the time you don't need to call anything
here separately; `Face.embedding` from detector.py *is* the ArcFace
embedding.

This module exists for the one case where you need to (re-)embed a face
crop that was NOT produced by FaceDetector.detect() in the same pass —
e.g. re-embedding an enrollment photo crop that a professor manually
adjusted, or embedding a crop stored on disk without re-running full
detection on it.
"""
from __future__ import annotations

import numpy as np

from app.ml.detector import get_detector


def embed_face_crop(face_crop: np.ndarray) -> np.ndarray | None:
    """Run detection+embedding on an already-cropped face image and return
    the single best (highest det_score) embedding found, or None if no
    face is detected in the crop."""
    detector = get_detector()
    faces = detector.detect(face_crop)
    if not faces:
        return None
    best = max(faces, key=lambda f: f.det_score)
    return best.embedding


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Both embeddings are expected to already be L2-normalized (as
    InsightFace's normed_embedding is), so this is just a dot product —
    kept as a named function for readability at call sites."""
    return float(np.dot(a, b))
