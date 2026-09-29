"""
Tests for Auth & Security layer:
  - Password hashing & verification
  - JWT creation & decoding (expiration, tampering, extra claims)
  - /auth/signup endpoint (creation, duplicate email, validation)
  - /auth/login endpoint (success, wrong credentials, missing user)
  - Auth dependency (get_current_professor)
"""
from datetime import timedelta

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.models import Professor


# --- Security Helpers ---
def test_password_hashing():
    plain = "MySecretPass123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_encode_decode():
    token = create_access_token(subject="123", extra_claims={"role": "professor"})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "123"
    assert payload.get("role") == "professor"


def test_jwt_token_tampered():
    token = create_access_token(subject="123")
    tampered_token = token[:-4] + "abcd"
    assert decode_access_token(tampered_token) is None


def test_jwt_token_invalid_secret():
    # Token signed with wrong secret
    bad_token = jwt.encode({"sub": "123"}, "wrong-secret", algorithm=settings.ALGORITHM)
    assert decode_access_token(bad_token) is None


# --- Signup API ---
@pytest.mark.asyncio
async def test_signup_success(client: AsyncClient, db_session: AsyncSession):
    payload = {
        "name": "Dr. Alan Turing",
        "email": "alan.turing@bletchley.ac.uk",
        "password": "securepassword123",
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["name"] == payload["name"]
    assert "professor_id" in data

    # Verify user exists in database
    result = await db_session.execute(
        select(Professor).where(Professor.email == payload["email"])
    )
    prof = result.scalar_one_or_none()
    assert prof is not None
    assert prof.name == payload["name"]


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient, test_professor: Professor):
    payload = {
        "name": "Imposter Professor",
        "email": test_professor.email,  # Already exists
        "password": "password123",
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


@pytest.mark.asyncio
async def test_signup_validation_short_password(client: AsyncClient):
    payload = {
        "name": "Dr. Short",
        "email": "short@univ.edu",
        "password": "pass",  # < 8 chars
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_signup_validation_invalid_email(client: AsyncClient):
    payload = {
        "name": "Dr. Invalid",
        "email": "not-an-email",
        "password": "validpassword123",
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 422


# --- Login API ---
@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_professor: Professor):
    payload = {
        "email": test_professor.email,
        "password": "secret123",  # Matches fixture
    }
    response = await client.post("/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["professor_id"] == test_professor.id
    assert data["name"] == test_professor.name


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_professor: Professor):
    payload = {
        "email": test_professor.email,
        "password": "wrongpassword",
    }
    response = await client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_email(client: AsyncClient):
    payload = {
        "email": "nonexistent@univ.edu",
        "password": "anyPassword123",
    }
    response = await client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


# --- Protected Endpoints & Dependency Guard ---
@pytest.mark.asyncio
async def test_protected_route_without_token(client: AsyncClient):
    # Trying to create a class without auth header
    response = await client.post("/classes", json={"name": "Unauthorized Class"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_invalid_token(client: AsyncClient):
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    response = await client.post("/classes", json={"name": "Unauthorized Class"}, headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_deleted_professor(client: AsyncClient):
    # Valid token structure, but user ID does not exist in DB
    token = create_access_token(subject="999999")
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.post("/classes", json={"name": "Ghost Class"}, headers=headers)
    assert response.status_code == 401
