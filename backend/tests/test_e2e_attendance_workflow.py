"""
Full End-to-End Attendance Workflow Integration Test:
  1. Professor Signup & Login (JWT Token)
  2. Class Creation
  3. Student Registration & Face Vector Enrollment
  4. Class Roster Association
  5. Session Photo Capture & Pipeline Execution
  6. Review API Payload Verification
  7. Human-in-the-loop Face Resolution (Confirm Alice, Reassign to Bob)
  8. Session Finalization (Charlie auto-marked Absent)
  9. Audit Log Integrity Check
"""
import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AttendanceRecord
from app.ml.detector import Face
from tests.conftest import create_synthetic_image_bytes, create_unit_embedding


@pytest.mark.asyncio
async def test_complete_attendance_e2e_workflow(
    client: AsyncClient,
    mock_detector,
    tmp_storage: str,
    db_session: AsyncSession,
):
    # -------------------------------------------------------------
    # Step 1: Professor Signup & Login
    # -------------------------------------------------------------
    prof_payload = {
        "name": "Prof. Ada Lovelace",
        "email": "ada.lovelace@oxford.edu",
        "password": "supersecretpass123",
    }
    signup_res = await client.post("/auth/signup", json=prof_payload)
    assert signup_res.status_code == 201

    login_res = await client.post(
        "/auth/login", json={"email": prof_payload["email"], "password": prof_payload["password"]}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # -------------------------------------------------------------
    # Step 2: Create a Class
    # -------------------------------------------------------------
    class_res = await client.post("/classes", json={"name": "CS401 Machine Learning"}, headers=headers)
    assert class_res.status_code == 201
    class_id = class_res.json()["id"]

    # -------------------------------------------------------------
    # Step 3: Register Students & Enroll Embeddings
    # -------------------------------------------------------------
    # Create 3 students: Alice, Bob, Charlie
    s_alice_res = await client.post("/students", json={"roll_no": "ALICE001", "name": "Alice Smith"}, headers=headers)
    assert s_alice_res.status_code == 201
    alice_id = s_alice_res.json()["id"]

    s_bob_res = await client.post("/students", json={"roll_no": "BOB002", "name": "Bob Jones"}, headers=headers)
    assert s_bob_res.status_code == 201
    bob_id = s_bob_res.json()["id"]

    s_charlie_res = await client.post("/students", json={"roll_no": "CHARLIE003", "name": "Charlie Brown"}, headers=headers)
    assert s_charlie_res.status_code == 201
    charlie_id = s_charlie_res.json()["id"]

    # Enroll face embeddings for Alice and Bob
    emb_alice = create_unit_embedding(111)
    emb_bob = create_unit_embedding(222)

    alice_face = Face(bbox=(20, 20, 100, 100), det_score=0.98, embedding=np.array(emb_alice, dtype=np.float32))
    mock_detector(faces=[alice_face])

    photo_alice = create_synthetic_image_bytes(300, 300)
    enroll_alice_res = await client.post(
        "/students/ALICE001/enroll",
        files=[("files", ("alice.jpg", photo_alice, "image/jpeg"))],
        headers=headers,
    )
    assert enroll_alice_res.status_code == 200
    assert enroll_alice_res.json()["photos_accepted"] == 1

    bob_face = Face(bbox=(20, 20, 100, 100), det_score=0.97, embedding=np.array(emb_bob, dtype=np.float32))
    mock_detector(faces=[bob_face])

    photo_bob = create_synthetic_image_bytes(300, 300)
    enroll_bob_res = await client.post(
        "/students/BOB002/enroll",
        files=[("files", ("bob.jpg", photo_bob, "image/jpeg"))],
        headers=headers,
    )
    assert enroll_bob_res.status_code == 200
    assert enroll_bob_res.json()["photos_accepted"] == 1

    # -------------------------------------------------------------
    # Step 4: Add Students to Class Roster
    # -------------------------------------------------------------
    roster_res = await client.post(
        f"/classes/{class_id}/roster",
        json={"student_ids": [alice_id, bob_id, charlie_id]},
        headers=headers,
    )
    assert roster_res.status_code == 204

    # -------------------------------------------------------------
    # Step 5: Upload Session Photo & Run Core Pipeline
    # -------------------------------------------------------------
    # Session photo contains:
    #   Face 1: High match with Alice (0.90) -> PRESENT
    #   Face 2: Slightly blurry/flagged match (0.50) -> FLAGGED (originally candidate for Bob)
    face_1 = Face(bbox=(10, 10, 80, 80), det_score=0.95, embedding=np.array(emb_alice, dtype=np.float32))
    # Slightly perturbed vector for face 2
    perturbed_bob = np.array(emb_bob, dtype=np.float32) * 0.5 + 0.1
    perturbed_bob = perturbed_bob / np.linalg.norm(perturbed_bob)
    face_2 = Face(bbox=(150, 150, 80, 80), det_score=0.92, embedding=perturbed_bob)

    mock_detector(faces=[face_1, face_2])

    class_photo = create_synthetic_image_bytes(400, 400)
    session_res = await client.post(
        "/sessions",
        data={"class_id": str(class_id)},
        files={"photo": ("session_photo.jpg", class_photo, "image/jpeg")},
        headers=headers,
    )
    assert session_res.status_code == 201
    session_id = session_res.json()["session_id"]
    assert session_res.json()["status"] == "reviewed"

    # -------------------------------------------------------------
    # Step 6: Fetch Review Payload
    # -------------------------------------------------------------
    review_res = await client.get(f"/sessions/{session_id}/review", headers=headers)
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert review_data["session_id"] == session_id
    assert len(review_data["faces"]) == 2

    # Check detected faces
    face_ids = {f["id"]: f for f in review_data["faces"]}
    assert len(face_ids) == 2

    # Charlie was never detected in photo
    not_detected_ids = {nd["student_id"] for nd in review_data["not_detected"]}
    assert charlie_id in not_detected_ids

    # -------------------------------------------------------------
    # Step 7: Resolve Faces (Human-in-the-loop review)
    # -------------------------------------------------------------
    # Confirm face 1 (Alice)
    face_1_id = [f["id"] for f in review_data["faces"] if f["matched_student_id"] == alice_id][0]
    resolve_alice = await client.post(
        f"/sessions/{session_id}/resolve",
        json={"detected_face_id": face_1_id, "action": "confirm"},
        headers=headers,
    )
    assert resolve_alice.status_code == 200
    assert resolve_alice.json()["classification"] == "present"

    # Reassign face 2 to Bob
    face_2_id = [f["id"] for f in review_data["faces"] if f["id"] != face_1_id][0]
    resolve_bob = await client.post(
        f"/sessions/{session_id}/resolve",
        json={"detected_face_id": face_2_id, "action": "reject", "reassign_student_id": bob_id},
        headers=headers,
    )
    assert resolve_bob.status_code == 200
    assert resolve_bob.json()["classification"] == "present"
    assert resolve_bob.json()["matched_student_id"] == bob_id

    # -------------------------------------------------------------
    # Step 8: Finalize Session
    # -------------------------------------------------------------
    finalize_res = await client.post(f"/sessions/{session_id}/finalize", headers=headers)
    assert finalize_res.status_code == 200
    fin_data = finalize_res.json()
    assert fin_data["status"] == "finalized"
    assert fin_data["present_count"] == 2  # Alice & Bob
    assert fin_data["absent_count"] == 1   # Charlie (auto-marked absent)

    # Verify Database Attendance Records
    records_res = await db_session.execute(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)
    )
    final_records = {r.student_id: r.status for r in records_res.scalars().all()}
    assert final_records[alice_id] == "present"
    assert final_records[bob_id] == "present"
    assert final_records[charlie_id] == "absent"

    # -------------------------------------------------------------
    # Step 9: Audit Trail Integrity Check
    # -------------------------------------------------------------
    audit_res = await client.get(f"/sessions/{session_id}/audit", headers=headers)
    assert audit_res.status_code == 200
    actions = [log["action"] for log in audit_res.json()]
    assert "session_created" in actions
    assert "processed" in actions
    assert "face_confirmed" in actions
    assert "face_rejected" in actions
    assert "finalized" in actions
