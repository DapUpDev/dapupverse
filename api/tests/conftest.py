"""Shared fixtures.

- A throwaway RSA key pair stands in for the Clerk instance; tokens are
  signed with it and the verifier is handed the public key through a fake
  JWKS, so every auth check runs the production code path without network.
- A real PostgreSQL for the database tests: TEST_DATABASE_URL when set (CI
  uses a service container), otherwise a temporary cluster started with the
  locally installed initdb/pg_ctl, torn down after the session.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import ClerkVerifier, get_verifier
from app.main import app

ISSUER = "https://clerk.example.test"
APP_ORIGIN = "https://www.dapup.space"


# ---- auth ----------------------------------------------------------------
@dataclass
class _Key:
    key: object


class FakeJWKS:
    def __init__(self, public_key) -> None:
        self.public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> _Key:
        return _Key(self.public_key)


@pytest.fixture(scope="session")
def keys():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private, private.public_key()


@pytest.fixture(autouse=True)
def verifier(keys):
    _, public = keys
    app.dependency_overrides[get_verifier] = lambda: ClerkVerifier(
        issuer=ISSUER, authorized_parties=[APP_ORIGIN], key_source=FakeJWKS(public)
    )
    yield
    app.dependency_overrides.clear()


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


# ---- database ------------------------------------------------------------
def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _find_pg_binary(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for candidate in (
        Path(os.getenv("PG_BIN", "")),
        Path(r"C:\Program Files\PostgreSQL\18\bin"),
        Path("/usr/lib/postgresql/18/bin"),
        Path("/opt/homebrew/opt/postgresql@18/bin"),
    ):
        for suffix in ("", ".exe"):
            path = candidate / f"{name}{suffix}"
            if candidate.name and path.exists():
                return str(path)
    return None


@pytest.fixture(scope="session")
def database_url():
    url = os.getenv("TEST_DATABASE_URL")
    if url:
        yield url
        return
    initdb, pg_ctl = _find_pg_binary("initdb"), _find_pg_binary("pg_ctl")
    if not initdb or not pg_ctl:
        pytest.skip("no PostgreSQL available: set TEST_DATABASE_URL or install initdb/pg_ctl")
    data_dir = tempfile.mkdtemp(prefix="dapup-pg-")
    port = _free_port()
    subprocess.run(
        [initdb, "-D", data_dir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-sync"],
        check=True, capture_output=True,
    )
    # No pipes here: the server pg_ctl launches inherits its stdio, and on
    # Windows a captured pipe never closes while the server lives, so
    # subprocess.run would wait forever. The server log goes to a file.
    subprocess.run(
        [pg_ctl, "-D", data_dir, "-w", "-l", os.path.join(data_dir, "server.log"),
         "-o", f"-p {port} -c listen_addresses=127.0.0.1 -c fsync=off", "start"],
        check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        yield f"postgresql+psycopg://postgres@127.0.0.1:{port}/postgres?sslmode=disable"
    finally:
        subprocess.run(
            [pg_ctl, "-D", data_dir, "-m", "fast", "stop"],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        shutil.rmtree(data_dir, ignore_errors=True)
