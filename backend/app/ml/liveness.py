"""
Liveness / anti-spoofing check (Phase 7 in the plan).

Intended to run Silent-Face-Anti-Spoofing (ONNX) on each detected face
crop before it's allowed into matching, to catch someone holding up a
phone photo of an absent student to the camera. Not required for the
MVP loop (detect -> quality gate -> embed -> match), so this is wired
as an optional, disableable step.

To activate: download the Silent-Face-Anti-Spoofing ONNX weights, drop
them at the path below, and flip ENABLE_LIVENESS_CHECK on in config.
"""
from __future__ import annotations

import os

import numpy as np

MODEL_PATH = os.environ.get(
    "LIVENESS_MODEL_PATH", "./models/silent_face_anti_spoofing.onnx"
)

_session = None


def _get_session():
    global _session
    if _session is None:
        import onnxruntime as ort

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Liveness model not found at {MODEL_PATH}. Download the "
                "Silent-Face-Anti-Spoofing ONNX weights and place them there, "
                "or set LIVENESS_MODEL_PATH."
            )
        _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    return _session


def is_live(face_crop: np.ndarray, threshold: float = 0.5) -> tuple[bool, float]:
    """Returns (is_live, spoof_score). Raises FileNotFoundError if the
    liveness model weights haven't been downloaded yet -- callers should
    catch this and skip the check (fail-open) or fail closed, depending
    on how strict you want the deployment to be."""
    session = _get_session()
    input_name = session.get_inputs()[0].name

    resized = _preprocess(face_crop)
    outputs = session.run(None, {input_name: resized})
    live_score = float(outputs[0][0][1]) if len(outputs[0][0]) > 1 else float(outputs[0][0][0])
    return live_score >= threshold, live_score


def _preprocess(face_crop: np.ndarray) -> np.ndarray:
    import cv2

    resized = cv2.resize(face_crop, (80, 80))
    normed = resized.astype(np.float32) / 255.0
    chw = np.transpose(normed, (2, 0, 1))
    return np.expand_dims(chw, axis=0)
