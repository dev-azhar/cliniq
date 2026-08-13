"""FastAPI application entrypoint."""
# Force reload trigger comment
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import (
    routes_admin,
    routes_ai,
    routes_billing,
    routes_clinical,
    routes_command,
    routes_journey,
    routes_oncology,
    routes_os,
    routes_ws,
)
from app.core.config import settings
from app.core.database import init_db
from app.core.events import bus
from app.realtime import hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    hub.bind_loop(asyncio.get_running_loop())
    bus.subscribe("*", hub.on_event)  # stream every domain event to WebSocket clients
    logging.getLogger("aarogya").info("ClinIQ backend ready · env=%s · db=%s",
                                       settings.environment, settings.database_url)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Open-source, ABDM-ready hospital platform orchestrating the full patient journey "
        "with a clinician-in-the-loop safety model."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(routes_journey.router)
app.include_router(routes_clinical.router)
app.include_router(routes_billing.router)
app.include_router(routes_command.router)
app.include_router(routes_ai.router)
app.include_router(routes_ws.router)
app.include_router(routes_admin.router)
app.include_router(routes_oncology.router)
app.include_router(routes_os.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/health",
        "modules": ["journey", "clinical", "billing", "command-center", "ai"],
    }
