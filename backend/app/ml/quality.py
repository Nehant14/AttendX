"""
Quality gate applied to each detected face crop before it's allowed into
matching. Rejects faces that are too small or too blurry to embed
reliably — these get surfaced to the professor as "not detected" rather
than being silently mismatched.
"""
from __future__ import annotations

import cv2
import numpy as np

from app.core.config import settings


def blur_score(face_crop: np.ndarray) -> float:
    """Variance of the Laplacian — a standard, cheap blur metric.
    Lower variance == blurrier image."""
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def passes_quality(
    face_crop: np.ndarray,
    min_size: int = settings.MIN_FACE_SIZE_PX,
    min_blur: float = settings.MIN_BLUR_SCORE,
) -> tuple[bool, str | None]:
    if face_crop is None or face_crop.size == 0:
        return False, "empty_crop"

    h, w = face_crop.shape[:2]
    if h < min_size or w < min_size:
        return False, "face_too_small"

    if blur_score(face_crop) < min_blur:
        return False, "too_blurry"

    return True, None


def crop_face(image: np.ndarray, bbox: tuple[float, float, float, float], pad: float = 0.15) -> np.ndarray:
    """Crop a face out of the full image given a bbox (x, y, w, h) in pixel
    space, with a small padding margin so the embedder sees a bit of
    context around the face."""
    h_img, w_img = image.shape[:2]
    x, y, w, h = bbox
    pad_x, pad_y = w * pad, h * pad

    x0 = max(int(x - pad_x), 0)
    y0 = max(int(y - pad_y), 0)
    x1 = min(int(x + w + pad_x), w_img)
    y1 = min(int(y + h + pad_y), h_img)

    return image[y0:y1, x0:x1]
