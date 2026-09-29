"""
Face detector wrapping InsightFace's FaceAnalysis (RetinaFace detector +
ArcFace recognition model, both bundled in the buffalo_l pack).

For large group photos, plain single-pass detection misses small/back-row
faces, so we optionally run tiled detection: split the image into
overlapping tiles, detect on each tile, map boxes back to full-image
coordinates, and merge overlapping detections with NMS.

This module is a singleton loaded once per process (model load is slow),
via get_detector().
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field

import numpy as np

from app.core.config import settings


@dataclass
class Face:
    bbox: tuple[float, float, float, float]  # x, y, w, h in ORIGINAL image pixel space
    det_score: float
    embedding: np.ndarray  # 512-d, L2-normalized
    landmarks: np.ndarray | None = field(default=None, repr=False)


class FaceDetector:
    """Thin wrapper around insightface.app.FaceAnalysis."""

    def __init__(self) -> None:
        # Imported lazily so the rest of the app (and tests that mock this
        # class out) can be exercised without the heavy ML deps installed.
        from insightface.app import FaceAnalysis

        self.app = FaceAnalysis(
            name=settings.MODEL_PACK,
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=0, det_size=(settings.DET_SIZE, settings.DET_SIZE))

    # -- single-pass detection --------------------------------------------------
    def _detect_raw(self, image: np.ndarray) -> list[Face]:
        results = self.app.get(image)
        faces: list[Face] = []
        for r in results:
            x1, y1, x2, y2 = r.bbox
            faces.append(
                Face(
                    bbox=(float(x1), float(y1), float(x2 - x1), float(y2 - y1)),
                    det_score=float(r.det_score),
                    embedding=np.asarray(r.normed_embedding, dtype=np.float32),
                    landmarks=getattr(r, "kps", None),
                )
            )
        return faces

    # -- tiled detection for large group photos ----------------------------------
    def _tile_bounds(self, width: int, height: int) -> list[tuple[int, int, int, int]]:
        tile = settings.TILE_SIZE
        overlap = int(tile * settings.TILE_OVERLAP)
        step = max(tile - overlap, 1)

        if width <= tile and height <= tile:
            return [(0, 0, width, height)]

        xs = list(range(0, max(width - tile, 0) + 1, step)) or [0]
        ys = list(range(0, max(height - tile, 0) + 1, step)) or [0]
        if xs[-1] + tile < width:
            xs.append(width - tile)
        if ys[-1] + tile < height:
            ys.append(height - tile)

        bounds = []
        for y in ys:
            for x in xs:
                x0, y0 = max(x, 0), max(y, 0)
                x1, y1 = min(x0 + tile, width), min(y0 + tile, height)
                bounds.append((x0, y0, x1, y1))
        return bounds

    def _detect_tiled(self, image: np.ndarray) -> list[Face]:
        h, w = image.shape[:2]
        all_faces: list[Face] = []
        for x0, y0, x1, y1 in self._tile_bounds(w, h):
            tile_img = image[y0:y1, x0:x1]
            if tile_img.size == 0:
                continue
            for face in self._detect_raw(tile_img):
                bx, by, bw, bh = face.bbox
                face.bbox = (bx + x0, by + y0, bw, bh)
                all_faces.append(face)
        return _nms_merge(all_faces, settings.NMS_IOU_THRESHOLD)

    def detect(self, image: np.ndarray) -> list[Face]:
        """Detect all faces in a BGR numpy image (as read by cv2.imread)."""
        if settings.ENABLE_TILED_DETECTION:
            h, w = image.shape[:2]
            if max(h, w) > settings.TILE_SIZE:
                return self._detect_tiled(image)
        return self._detect_raw(image)


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax0, ay0, aw, ah = a
    bx0, by0, bw, bh = b
    ax1, ay1 = ax0 + aw, ay0 + ah
    bx1, by1 = bx0 + bw, by0 + bh

    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(ix1 - ix0, 0), max(iy1 - iy0, 0)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _nms_merge(faces: list[Face], iou_thresh: float) -> list[Face]:
    """Greedy NMS across tile boundaries, keeping the highest-scoring face
    in each cluster of overlapping detections."""
    faces_sorted = sorted(faces, key=lambda f: f.det_score, reverse=True)
    kept: list[Face] = []
    for face in faces_sorted:
        if all(_iou(face.bbox, k.bbox) < iou_thresh for k in kept):
            kept.append(face)
    return kept


_detector_lock = threading.Lock()
_detector_instance: FaceDetector | None = None


def get_detector() -> FaceDetector:
    """Process-wide singleton — loading the model pack is expensive, so we
    only want to pay that cost once."""
    global _detector_instance
    if _detector_instance is None:
        with _detector_lock:
            if _detector_instance is None:
                _detector_instance = FaceDetector()
    return _detector_instance
