"""Clerk session-token verification.

Clerk's Next.js middleware protects only the Next.js app. Every request that
reaches this API must prove who it is on its own, so each protected route
takes a `Principal` produced here.

How a request is verified:

1. The `Authorization: Bearer <token>` header carries a Clerk session token,
   a short-lived JWT signed (RS256) by the Clerk instance.
2. The signing key is fetched from the instance's JWKS endpoint
   (`<issuer>/.well-known/jwks.json`) and cached; no Clerk secret key is
   needed anywhere in the API.
3. Signature, `exp`, `nbf`, and `iss` are checked by PyJWT. `azp` (the
   browser origin the token was minted for) must be one of the authorized
   parties when present, which stops a token minted for another site from
   being replayed here. Tokens minted server-side carry no `azp`, so an
   absent claim is accepted, exactly as Clerk's own SDKs do.

Configuration (environment):

- `CLERK_ISSUER`: the instance's frontend API origin, e.g.
  `https://clerk.dapup.space` (production) or
  `https://<slug>.clerk.accounts.dev` (development). Required for any
  protected route; `/health` never needs it.
- `CLERK_AUTHORIZED_PARTIES`: comma-separated origins. Defaults to
  `CORS_ALLOWED_ORIGINS`, the same browsers that may call the API.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

log = logging.getLogger("dapup.auth")

# Small tolerance for clock drift between Clerk and this container.
CLOCK_LEEWAY_SECONDS = 5


@dataclass(frozen=True)
class Principal:
    """The verified identity a protected route receives."""

    user_id: str
    session_id: str | None


class AuthError(Exception):
    """Token missing, malformed, expired, or not issued for this API."""


class SigningKeySource(Protocol):
    """The one thing the verifier needs from a JWKS: the key for a token."""

    def get_signing_key_from_jwt(self, token: str):  # pragma: no cover - protocol
        ...


class ClerkVerifier:
    def __init__(
        self,
        issuer: str,
        authorized_parties: list[str],
        key_source: SigningKeySource | None = None,
    ) -> None:
        self.issuer = issuer.rstrip("/")
        self.authorized_parties = authorized_parties
        self.key_source: SigningKeySource = key_source or PyJWKClient(
            f"{self.issuer}/.well-known/jwks.json",
            cache_keys=True,
            lifespan=3600,
        )

    def verify(self, token: str) -> Principal:
        try:
            signing_key = self.key_source.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=self.issuer,
                leeway=CLOCK_LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "sub"]},
            )
        except PyJWKClientError as exc:
            # Unknown key id, or the JWKS could not be fetched.
            raise AuthError(f"signing key unavailable: {exc}") from exc
        except InvalidTokenError as exc:
            raise AuthError(f"invalid token: {exc.__class__.__name__}") from exc

        azp = claims.get("azp")
        if azp is not None and azp not in self.authorized_parties:
            raise AuthError("token was not issued for this application")

        return Principal(user_id=claims["sub"], session_id=claims.get("sid"))


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_verifier() -> ClerkVerifier:
    """Process-wide verifier built from the environment, created on first use."""
    issuer = os.getenv("CLERK_ISSUER", "").strip()
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured (CLERK_ISSUER is unset).",
        )
    parties = _split_csv(
        os.getenv("CLERK_AUTHORIZED_PARTIES") or os.getenv("CORS_ALLOWED_ORIGINS", "")
    )
    return ClerkVerifier(issuer=issuer, authorized_parties=parties)


_bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: ClerkVerifier = Depends(get_verifier),
) -> Principal:
    """FastAPI dependency: the verified caller, or 401.

    The response body never says *why* a token failed; the reason goes to the
    log, where an operator can read it and an attacker cannot.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        return verifier.verify(credentials.credentials)
    except AuthError as exc:
        log.info("rejected token: %s", exc)
        raise unauthorized from exc
