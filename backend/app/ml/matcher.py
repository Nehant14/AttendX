"""
Matching logic: given a query face embedding and the enrolled embeddings
for every student on a class roster, find the best-matching student and
classify the match as present / flagged / unmatched using a two-threshold
scheme. Also implements the duplicate-match guard described in the plan:
if the same student is the best match for two different detected faces,
both are downgraded to "flagged" rather than one silently winning.

Priority per the plan is minimizing false negatives (present student
marked absent), which is why there's a "flagged" middle tier instead of
a single present/absent cutoff — borderline matches go to the professor
for a quick visual confirm rather than being auto-rejected.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.core.config import settings

PRESENT = "present"
FLAGGED = "flagged"
UNMATCHED = "unmatched"


@dataclass
class MatchResult:
    face_index: int
    student_id: int | None
    score: float
    classification: str


def classify(score: float) -> str:
    if score > settings.HIGH_MATCH_THRESHOLD:
        return PRESENT
    if score > settings.LOW_MATCH_THRESHOLD:
        return FLAGGED
    return UNMATCHED


def match_face(
    query_embedding: np.ndarray,
    candidate_embeddings_by_student: dict[int, list[np.ndarray]],
) -> tuple[int | None, float]:
    """Best-matching student id + similarity score for one face."""
    best_student: int | None = None
    best_score = -1.0
    for student_id, embeddings in candidate_embeddings_by_student.items():
        if not embeddings:
            continue
        sims = [float(np.dot(query_embedding, e)) for e in embeddings]
        max_sim = max(sims)
        if max_sim > best_score:
            best_score, best_student = max_sim, student_id
    return best_student, best_score


def match_all_faces(
    query_embeddings: list[np.ndarray],
    candidate_embeddings_by_student: dict[int, list[np.ndarray]],
) -> list[MatchResult]:
    """Match every detected face against the roster, then apply the
    duplicate-match guard: if two different faces both best-match the
    same student, downgrade both to 'flagged' regardless of score,
    since at most one of them can actually be that student."""
    raw_results: list[MatchResult] = []
    for i, emb in enumerate(query_embeddings):
        student_id, score = match_face(emb, candidate_embeddings_by_student)
        cls = classify(score) if student_id is not None else UNMATCHED
        raw_results.append(MatchResult(face_index=i, student_id=student_id, score=score, classification=cls))

    # Duplicate-match guard
    counts: dict[int, int] = {}
    for r in raw_results:
        if r.student_id is not None and r.classification in (PRESENT, FLAGGED):
            counts[r.student_id] = counts.get(r.student_id, 0) + 1

    for r in raw_results:
        if r.student_id is not None and counts.get(r.student_id, 0) > 1 and r.classification == PRESENT:
            r.classification = FLAGGED

    return raw_results
