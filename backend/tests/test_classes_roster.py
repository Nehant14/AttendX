"""
Tests for Classes and Roster API endpoints:
  - Class creation & ownership checks
  - Roster management (adding students, duplicate handling, missing student 404)
  - Roster retrieval & isolation between professors
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.db.models import ClassModel, ClassRoster, Professor, Student


@pytest.mark.asyncio
async def test_create_class(client: AsyncClient, auth_headers: dict[str, str], test_professor: Professor):
    payload = {"name": "Data Structures 101"}
    response = await client.post("/classes", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Data Structures 101"
    assert data["professor_id"] == test_professor.id
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_add_to_roster_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    # Add second student
    student2 = Student(roll_no="STU002", name="Bob Jones")
    db_session.add(student2)
    await db_session.commit()
    await db_session.refresh(student2)

    payload = {"student_ids": [test_student.id, student2.id]}
    response = await client.post(f"/classes/{test_class.id}/roster", json=payload, headers=auth_headers)
    assert response.status_code == 204

    # Verify database records
    result = await db_session.execute(
        select(ClassRoster).where(ClassRoster.class_id == test_class.id)
    )
    roster_rows = result.scalars().all()
    assert len(roster_rows) == 2
    student_ids_in_roster = {r.student_id for r in roster_rows}
    assert student_ids_in_roster == {test_student.id, student2.id}


@pytest.mark.asyncio
async def test_add_to_roster_idempotent(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    # Add student once directly in DB
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    await db_session.commit()

    # Submit roster add request again
    payload = {"student_ids": [test_student.id]}
    response = await client.post(f"/classes/{test_class.id}/roster", json=payload, headers=auth_headers)
    assert response.status_code == 204

    # Should still only have 1 row
    result = await db_session.execute(
        select(ClassRoster).where(ClassRoster.class_id == test_class.id)
    )
    roster_rows = result.scalars().all()
    assert len(roster_rows) == 1


@pytest.mark.asyncio
async def test_add_to_roster_nonexistent_student(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
):
    payload = {"student_ids": [999999]}
    response = await client.post(f"/classes/{test_class.id}/roster", json=payload, headers=auth_headers)
    assert response.status_code == 404
    assert "Student 999999 not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_roster(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    await db_session.commit()

    response = await client.get(f"/classes/{test_class.id}/roster", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_student.id
    assert data[0]["roll_no"] == test_student.roll_no
    assert data[0]["name"] == test_student.name


@pytest.mark.asyncio
async def test_roster_access_other_professor_class(
    client: AsyncClient,
    auth_headers: dict[str, str],
    db_session: AsyncSession,
):
    # Create another professor and their class
    other_prof = Professor(
        name="Dr. Other",
        email="other@univ.edu",
        password_hash=hash_password("password123"),
    )
    db_session.add(other_prof)
    await db_session.commit()
    await db_session.refresh(other_prof)

    other_class = ClassModel(name="Other Prof Class", professor_id=other_prof.id)
    db_session.add(other_class)
    await db_session.commit()
    await db_session.refresh(other_class)

    # Attempt to view roster using test_professor's auth_headers
    response = await client.get(f"/classes/{other_class.id}/roster", headers=auth_headers)
    assert response.status_code == 404
    assert "Class not found" in response.json()["detail"]
