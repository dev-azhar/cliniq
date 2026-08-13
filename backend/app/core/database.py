"""Database engine, session factory and FastAPI dependency."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


# SQLite needs check_same_thread=False for FastAPI's threadpool. Supabase's
# transaction pooler (port 6543) cannot safely retain psycopg named prepared
# statements because server connections are shared between clients.
_database_url = make_url(settings.database_url)
if settings.is_sqlite:
    _connect_args = {"check_same_thread": False}
elif _database_url.drivername == "postgresql+psycopg" and _database_url.port == 6543:
    _connect_args = {"prepare_threshold": None}
else:
    _connect_args = {}

engine = create_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    """Yield a scoped database session (FastAPI dependency)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Import models so they register on the metadata."""
    from app import models  # noqa: F401  (side-effect: register mappers)

    Base.metadata.create_all(bind=engine)

    # This project intentionally has no migration framework. Keep existing demo
    # databases compatible when a new nullable encounter link is introduced.
    if "appointment_id" not in {column["name"] for column in inspect(engine).get_columns("encounter")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE encounter ADD COLUMN appointment_id VARCHAR(36)"))

    # Keep existing demo databases compatible with patient profile photos.
    if "profile_photo" not in {column["name"] for column in inspect(engine).get_columns("patient")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE patient ADD COLUMN profile_photo TEXT"))

    # Uploaded patient documents are stored as data URLs and can exceed the old
    # VARCHAR(300) limit. SQLite TEXT affinity is dynamic; Postgres needs this DDL.
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE document ALTER COLUMN uri TYPE TEXT"))

    # Keep existing demo databases compatible with doctor-only AI lab analysis.
    if "ai_analysis_summary" not in {column["name"] for column in inspect(engine).get_columns("lab_order")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE lab_order ADD COLUMN ai_analysis_summary TEXT"))

    # Keep existing demo databases compatible with prescription dosing instructions.
    if "instructions" not in {column["name"] for column in inspect(engine).get_columns("prescription_item")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE prescription_item ADD COLUMN instructions VARCHAR(200)"))

    # Keep existing demo databases compatible with the sample-collection workflow step.
    if "sample_collected_ts" not in {column["name"] for column in inspect(engine).get_columns("lab_order")}:
        column_type = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "TIMESTAMP"
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE lab_order ADD COLUMN sample_collected_ts {column_type}"))

    # Keep existing demo databases compatible with the newer Staff EMR / login fields.
    _staff_columns = {
        "hpr_id": "VARCHAR(40)",
        "experience_years": "INTEGER",
        "room": "VARCHAR(20)",
        "floor": "VARCHAR(20)",
        "access_pin": "VARCHAR(40)",
        "opd_fee": "FLOAT",
    }
    _existing_staff = {column["name"] for column in inspect(engine).get_columns("staff")}
    for _name, _type in _staff_columns.items():
        if _name not in _existing_staff:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE staff ADD COLUMN {_name} {_type}"))
