"""Application configuration loaded from environment / .env."""
from __future__ import annotations

import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "ClinIQ — Smart Hospital Platform"
    app_version: str = "0.1.0"
    environment: str = "development"

    # Data
    database_url: str = "sqlite:///./smart_hospital.db"

    # AI / Ollama (optional — deterministic fallback if unavailable)
    ai_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    gemini_api_key: str | None = None
    grok_api_key: str | None = None
    grok_api: str | None = None
    ai_timeout_seconds: float = 20.0

    # Local speech-to-text (Ambient SOAP live dictation) — faster-whisper, fully offline
    whisper_model_size: str = "base"

    # Security
    jwt_secret: str = "dev-secret-change-me"

    # Twilio Verify (SMS OTP)
    twilio_verify_enabled: bool = False
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_verify_service_sid: str = ""
    twilio_country_code: str = "+91"
    twilio_test_mobile_numbers: str = ""

    # Razorpay Standard Checkout
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    @property
    def razorpay_configured(self) -> bool:
        return bool(self.razorpay_key_id.strip() and self.razorpay_key_secret.strip())

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def cors_origin_list(self) -> list[str]:
        value = self.cors_origins.strip()
        if not value:
            return []
        if value.startswith("["):
            parsed = json.loads(value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @property
    def twilio_verify_configured(self) -> bool:
        return all((
            self.twilio_account_sid.strip(),
            self.twilio_auth_token.strip(),
            self.twilio_verify_service_sid.strip(),
        ))


settings = Settings()
