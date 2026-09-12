"""Clerk token verification, exercised with real RS256 signatures.

A throwaway RSA key pair stands in for the Clerk instance: tokens are
signed with the private key and the verifier is handed the public key
through a fake JWKS source, so every check (signature, expiry, issuer,
authorized party) runs the same code path production does, without the
network.
"""

import time
from dataclasses import dataclass

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.auth import ClerkVerifier, get_verifier
from app.main import app

ISSUER = "https://clerk.example.test"
APP_ORIGIN = "https://www.dapup.space"


@dataclass
class _Key:
    key: object


class FakeJWKS:
    def __init__(self, public_key) -> None:
        self.public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> _Key:
        return _Key(self.public_key)


@pytest.fixture(scope="module")
def keys():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private, private.public_key()


@pytest.fixture(scope="module")
def other_private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def verifier(keys):
    _, public = keys
    app.dependency_overrides[get_verifier] = lambda: ClerkVerifier(
        issuer=ISSUER, authorized_parties=[APP_ORIGIN], key_source=FakeJWKS(public)
    )
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def mint(private_key, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "sub": "user_2abc",
        "sid": "sess_9xyz",
        "azp": APP_ORIGIN,
        "iat": now,
        "nbf": now,
        "exp": now + 60,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, private_key, algorithm="RS256")


def test_no_header_is_rejected(client):
    response = client.get("/me")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_wrong_scheme_is_rejected(client):
    response = client.get("/me", headers={"Authorization": "Basic abc"})
    assert response.status_code == 401


def test_valid_token_returns_the_user(client, keys):
    private, _ = keys
    response = client.get("/me", headers={"Authorization": f"Bearer {mint(private)}"})
    assert response.status_code == 200
    assert response.json() == {"user_id": "user_2abc", "session_id": "sess_9xyz"}


def test_expired_token_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, exp=int(time.time()) - 60)
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_wrong_issuer_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, iss="https://someone-else.example")
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_token_for_another_site_is_rejected(client, keys):
    private, _ = keys
    token = mint(private, azp="https://evil.example")
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_server_minted_token_without_azp_is_accepted(client, keys):
    private, _ = keys
    token = mint(private, azp=None)
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_token_signed_by_another_key_is_rejected(client, other_private_key):
    token = mint(other_private_key)
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_garbage_token_is_rejected(client):
    response = client.get("/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


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
    response = client.get("/me", headers={"Authorization": "Bearer x"})
    assert response.status_code == 503
    get_verifier.cache_clear()
