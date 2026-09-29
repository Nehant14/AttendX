"""
Unit tests for the matching/classification logic (app/ml/matcher.py).
These don't require InsightFace models to be downloaded — they operate
on plain numpy vectors.
"""
import numpy as np

from app.ml.matcher import FLAGGED, PRESENT, UNMATCHED, classify, match_all_faces, match_face


def unit(v):
    v = np.array(v, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_classify_thresholds():
    assert classify(0.9) == PRESENT
    assert classify(0.5) == FLAGGED
    assert classify(0.1) == UNMATCHED


def test_match_face_picks_best_student():
    query = unit([1, 0, 0])
    candidates = {
        1: [unit([1, 0, 0])],   # perfect match
        2: [unit([0, 1, 0])],   # orthogonal, no match
    }
    student_id, score = match_face(query, candidates)
    assert student_id == 1
    assert score > 0.99


def test_duplicate_match_guard_downgrades_both():
    # Two faces both best-match student 1 above the high threshold.
    face_a = unit([1, 0, 0])
    face_b = unit([0.99, 0.01, 0])
    candidates = {1: [unit([1, 0, 0])]}

    results = match_all_faces([face_a, face_b], candidates)

    assert all(r.student_id == 1 for r in results)
    assert all(r.classification == FLAGGED for r in results), (
        "both faces matching the same student should be downgraded to flagged"
    )


def test_no_roster_embeddings_is_unmatched():
    query = unit([1, 0, 0])
    results = match_all_faces([query], {1: []})
    assert results[0].classification == UNMATCHED
    assert results[0].student_id is None
