"""Stateless session tokens for the Smart Hospital OS (`/os`) console.

A minimal, dependency-free HS256 JWT implementation signed with ``settings.jwt_secret``.
Tokens are tamper-proof and carry an expiry, so the backend can enforce access on
the OS data endpoints instead of trusting a client-held flag.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

# Default OS session lifetime (seconds). A clinician shift ~ 8 hours.
OS_TOKEN_TTL_SECONDS = 8 * 60 * 60

_bearer = HTTPBearer(auto_error=False)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(seg: str) -> bytes:
    return base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4))


def _sign(signing_input: str) -> str:
    digest = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return _b64url(digest)


def sign_os_token(claims: dict, ttl_seconds: int = OS_TOKEN_TTL_SECONDS) -> tuple[str, int]:
    """Return ``(token, expiresAtEpochSeconds)`` for the given claims."""
    now = int(time.time())
    exp = now + ttl_seconds
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {**claims, "iat": now, "exp": exp}
    signing_input = f"{_b64url(json.dumps(header, separators=(',', ':')).encode())}." \
                    f"{_b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    return f"{signing_input}.{_sign(signing_input)}", exp


def verify_os_token(token: str) -> dict | None:
    """Return the claims if the token is authentic and unexpired, else ``None``."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        return None
    signing_input = f"{header_b64}.{payload_b64}"
    if not hmac.compare_digest(_sign(signing_input), sig_b64):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def require_os_staff(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """FastAPI dependency: require a valid, unexpired OS bearer token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    claims = verify_os_token(credentials.credentials)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
        )
    return claims


def require_portal_patient(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """FastAPI dependency: require a valid patient-scoped portal token.

    Distinct from :func:`require_os_staff` — a staff token cannot read patient
    portal data because it lacks ``scope == "patient"`` and ``patientId``.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    claims = verify_os_token(credentials.credentials)
    if claims is None or claims.get("scope") != "patient" or not claims.get("patientId"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
        )
    return claims
