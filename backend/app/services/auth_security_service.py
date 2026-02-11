from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.utils.log_safe import safe_identifier


def _now_ts() -> float:
    return time.time()


def _norm(value: str | None) -> str:
    if not value:
        return "-"
    return value.strip().lower() or "-"


def _extract_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@dataclass
class _LockState:
    failures: int = 0
    locked_until_ts: float = 0.0


class AuthSecurityService:
    """
    In-memory auth abuse guards.

    This intentionally wraps routes without changing auth business rules.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rate_buckets: dict[str, Deque[float]] = defaultdict(deque)
        self._login_lockouts: dict[str, _LockState] = defaultdict(_LockState)
        self._logger = logging.getLogger(__name__)

    def _raise_throttled(self) -> None:
        detail = (
            "Muitas tentativas. Tente novamente em instantes."
            if settings.ERROR_SCHEMA_ENFORCE_429_413
            else "Muitas tentativas. Tente novamente em instantes."
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )

    def _bucket_key(self, action: str, ip: str, principal: str | None = None) -> str:
        if principal:
            return f"{action}|{ip}|{_norm(principal)}"
        return f"{action}|{ip}"

    def enforce_rate_limit(self, *, request: Request, action: str, principal: str | None = None) -> None:
        if not settings.AUTH_RL_ENABLED:
            return

        now = _now_ts()
        window_sec = max(int(settings.AUTH_RL_WINDOW_SEC), 1)
        max_hits = max(int(settings.AUTH_RL_MAX), 1)
        cutoff = now - window_sec
        ip = _extract_ip(request)

        keys = [self._bucket_key(action=action, ip=ip)]
        if principal:
            keys.append(self._bucket_key(action=action, ip=ip, principal=principal))

        with self._lock:
            for key in keys:
                bucket = self._rate_buckets[key]
                while bucket and bucket[0] < cutoff:
                    bucket.popleft()
                if len(bucket) >= max_hits:
                    self._logger.warning(
                        "auth_rate_limited action=%s ip=%s principal=%s",
                        action,
                        safe_identifier(ip),
                        safe_identifier(principal),
                    )
                    self._raise_throttled()
            for key in keys:
                self._rate_buckets[key].append(now)

    def enforce_login_lockout(self, *, request: Request, email: str) -> None:
        if not settings.AUTH_LOCKOUT_ENABLED:
            return
        now = _now_ts()
        ip = _extract_ip(request)
        key = self._bucket_key(action="login-lockout", ip=ip, principal=email)
        with self._lock:
            st = self._login_lockouts[key]
            if st.locked_until_ts > now:
                self._logger.warning(
                    "auth_lockout_blocked ip=%s principal=%s",
                    safe_identifier(ip),
                    safe_identifier(email),
                )
                self._raise_throttled()
            if st.locked_until_ts and st.locked_until_ts <= now:
                st.failures = 0
                st.locked_until_ts = 0.0

    def record_login_failure(self, *, request: Request, email: str) -> None:
        if not settings.AUTH_LOCKOUT_ENABLED:
            return
        max_attempts = max(int(settings.AUTH_LOCKOUT_MAX_ATTEMPTS), 1)
        lockout_minutes = max(int(settings.AUTH_LOCKOUT_MINUTES), 1)
        now = _now_ts()
        ip = _extract_ip(request)
        key = self._bucket_key(action="login-lockout", ip=ip, principal=email)

        with self._lock:
            st = self._login_lockouts[key]
            if st.locked_until_ts and st.locked_until_ts <= now:
                st.failures = 0
                st.locked_until_ts = 0.0
            st.failures += 1
            if st.failures >= max_attempts:
                st.locked_until_ts = now + (lockout_minutes * 60)
                self._logger.warning(
                    "auth_lockout_started ip=%s principal=%s duration_min=%s",
                    safe_identifier(ip),
                    safe_identifier(email),
                    lockout_minutes,
                )

    def record_login_success(self, *, request: Request, email: str) -> None:
        key = self._bucket_key(action="login-lockout", ip=_extract_ip(request), principal=email)
        with self._lock:
            self._login_lockouts.pop(key, None)
