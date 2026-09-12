"""Clerk token verification, exercised with real RS256 signatures (see conftest)."""

import time

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.auth import get_verifier, principal_from_claims
from app.main import app
from tests.conftest import mint


@pytest.fixture(scope="module")
def other_private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def client():
    return TestClient(app)


def test_no_header_is_rejected(client):
    response = client.get("/me")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_wrong_scheme_is_rejected(client):
    assert client.get("/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_expired_token_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, exp=int(time.time()) - 60)
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_wrong_issuer_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, iss="https://someone-else.example")
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_for_another_site_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, azp="https://evil.example")
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_signed_by_another_key_is_rejected(client, other_private_key):
    token = mint(other_private_key)
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_garbage_token_is_rejected(client):
    assert client.get("/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401


def test_rejection_body_does_not_explain_why(client, keys):
    private, _ = keys
    token = mint(private, exp=int(time.time()) - 60)
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.json() == {"detail": "Not authenticated"}


def test_health_stays_public(client):
    assert client.get("/health").status_code == 200


def test_unconfigured_issuer_is_a_503_not_a_crash(client, monkeypatch):
    app.dependency_overrides.clear()
    get_verifier.cache_clear()
    monkeypatch.delenv("CLERK_ISSUER", raising=False)
    assert client.get("/me", headers={"Authorization": "Bearer x"}).status_code == 503
    get_verifier.cache_clear()


# ---- role claims: least privilege, mirroring the frontend's claims.ts --------
def test_missing_metadata_means_student_not_admin():
    p = principal_from_claims({"sub": "u", "sid": "s"})
    assert (p.account_type, p.is_admin, p.email) == ("student", False, None)


def test_mentor_with_admin_capability():
    p = principal_from_claims(
        {"sub": "u", "metadata": {"accountType": "mentor", "capabilities": {"isAdmin": True}},
         "email": "m@example.com"}
    )
    assert (p.account_type, p.is_admin, p.email) == ("mentor", True, "m@example.com")


def test_elevated_values_are_never_coerced():
    p = principal_from_claims(
        {"sub": "u", "metadata": {"accountType": "MENTOR", "capabilities": {"isAdmin": "true"}},
         "email": "not-an-email"}
    )
    assert (p.account_type, p.is_admin, p.email) == ("student", False, None)


def test_malformed_metadata_is_ignored():
    p = principal_from_claims({"sub": "u", "metadata": ["mentor"]})
    assert (p.account_type, p.is_admin) == ("student", False)
