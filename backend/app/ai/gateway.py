"""Model Gateway — a single seam in front of every LLM call.

Talks to a self-hosted Ollama server when reachable. If the server is down, the model is missing,
or AI is disabled, `generate()` returns ``None`` and callers fall back to the deterministic clinical
engine. This is what lets the whole platform run with zero GPU while staying upgrade-ready.
"""
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("aarogya.ai.gateway")


class ModelGateway:
    def __init__(self) -> None:
        self._base = settings.ollama_base_url.rstrip("/")
        self._model = settings.ollama_model
        self._timeout = settings.ai_timeout_seconds
        self._known_available: bool | None = None

    def available(self) -> bool:
        """Probe reachability for LLM services."""
        if not settings.ai_enabled:
            return False
        # If Gemini key or Grok key is provided, the API service is cloud-hosted and assumed available
        if settings.gemini_api_key or settings.grok_api_key or settings.grok_api:
            return True
        if self._known_available:
            return True
        try:
            resp = httpx.get(f"{self._base}/api/tags", timeout=2.0)
            self._known_available = resp.status_code == 200
        except Exception:  # noqa: BLE001
            self._known_available = False
        return bool(self._known_available)

    def active_model_name(self) -> str:
        if settings.gemini_api_key:
            return "gemini-flash-latest"
        gkey = settings.grok_api_key or settings.grok_api
        if gkey:
            if gkey.startswith("gsk_"):
                return "llama-3.3-70b-versatile"
            return "grok-beta"
        return settings.ollama_model

    def _generate_grok(
        self,
        api_key: str,
        prompt: str,
        system: str | None = None,
        json_mode: bool = False,
        temperature: float = 0.2,
    ) -> str | None:
        if api_key.startswith("gsk_"):
            url = "https://api.groq.com/openai/v1/chat/completions"
            model = "llama-3.3-70b-versatile"
        else:
            url = "https://api.x.ai/v1/chat/completions"
            model = "grok-beta"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "messages": messages,
            "model": model,
            "stream": False,
            "temperature": temperature
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
            
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=self._timeout)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices") or []
            if choices:
                text = choices[0].get("message", {}).get("content")
                if text:
                    print(f"\033[92m[ModelGateway] Grok/Groq API call success (model={model}). Prompt: ~{len(prompt)//4} tokens, Response: {len(text)} chars\033[0m")
                    logger.info("Grok/Groq API call success")
                    return text.strip()
            return None
        except Exception as e:
            logger.warning("Grok/Groq API call failed: %s", str(e))
            return None

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        json_mode: bool = False,
        temperature: float = 0.2,
    ) -> str | None:
        """Return model text, or ``None`` if the LLM is unavailable/errored."""
        if not self.available():
            return None

        # --- Google Gemini Integration ---
        if settings.gemini_api_key:
            # Use gemini-flash-latest (points to Google's current active stable Flash model)
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
            headers = {"x-goog-api-key": settings.gemini_api_key}
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": temperature
                }
            }
            if system:
                payload["systemInstruction"] = {
                    "parts": [{"text": system}]
                }
            if json_mode:
                payload["generationConfig"]["responseMimeType"] = "application/json"

            try:
                resp = httpx.post(url, json=payload, headers=headers, timeout=self._timeout)
                resp.raise_for_status()
                data = resp.json()
                candidates = data.get("candidates") or []
                if candidates:
                    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
                    if text:
                        print(f"\033[92m[ModelGateway] Gemini API call success (model=gemini-flash-latest). Prompt: ~{len(prompt)//4} tokens, Response: {len(text)} chars\033[0m")
                        logger.info("Gemini API call success")
                        return text.strip()
            except Exception as e:
                logger.warning("Gemini API call failed: %s; trying Grok fallback...", str(e))
                # Fall through to Grok check

        # --- xAI Grok Fallback (if Gemini fails or is not set) ---
        grok_key = settings.grok_api_key or settings.grok_api
        if grok_key:
            grok_res = self._generate_grok(
                api_key=grok_key,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
                temperature=temperature,
            )
            if grok_res:
                return grok_res

        # --- Ollama Fallback ---
        body: dict[str, object] = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system:
            body["system"] = system
        if json_mode:
            body["format"] = "json"
        try:
            resp = httpx.post(f"{self._base}/api/generate", json=body, timeout=self._timeout)
            resp.raise_for_status()
            res_text = (resp.json().get("response") or "").strip()
            if res_text:
                print(f"\033[92m[ModelGateway] Ollama API call success (model={self._model}). Prompt: ~{len(prompt)//4} tokens, Response: {len(res_text)} chars\033[0m")
                logger.info("Ollama API call success")
                return res_text
            return None
        except Exception:  # noqa: BLE001
            logger.warning("Ollama LLM generate failed; using deterministic fallback", exc_info=False)
            self._known_available = None  # re-probe next time
            return None

    def generate_json(
        self, prompt: str, *, system: str | None = None
    ) -> dict | list | None:
        """Generate and parse JSON. Returns ``None`` on any failure."""
        raw = self.generate(prompt, system=system, json_mode=True)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start, end = raw.find("{"), raw.rfind("}")
            if 0 <= start < end:
                try:
                    return json.loads(raw[start : end + 1])
                except json.JSONDecodeError:
                    return None
        return None


gateway = ModelGateway()
