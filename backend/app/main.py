from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AuthError, BadRequestError, ForbiddenError, NotFoundError, PlanLimitExceeded
from app.services.audit_service import register_audit_listeners


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    # Register once, process-wide.
    register_audit_listeners()
    yield


app = FastAPI(
    title="SaaS Jurídico API",
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(AuthError)
async def auth_error_handler(_: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def forbidden_error_handler(_: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(PlanLimitExceeded)
async def plan_limit_error_handler(_: Request, exc: PlanLimitExceeded):
    payload: dict[str, object] = {"detail": exc.message, "code": exc.code}
    if exc.resource:
        payload["resource"] = exc.resource
    if exc.limit is not None:
        payload["limit"] = exc.limit
    return JSONResponse(status_code=403, content=payload)


@app.exception_handler(NotFoundError)
async def not_found_error_handler(_: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(BadRequestError)
async def bad_request_error_handler(_: Request, exc: BadRequestError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    # Catch-all. Prefer explicit messages in endpoints for user-facing constraints.
    return JSONResponse(status_code=400, content={"detail": "Violação de integridade"})
