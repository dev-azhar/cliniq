"""Local, offline speech-to-text for the Ambient SOAP live-dictation feature.

Uses faster-whisper (CTranslate2-optimized Whisper) so consultation audio is
transcribed entirely on this server and never sent to a third-party cloud speech
API — keeps the app's self-hosted / consent-first / DPDP-aligned posture instead
of streaming raw patient conversation audio off-box.

Also does lightweight, fully-offline speaker diarization (via speechbrain's
ECAPA speaker-embedding model) so the live transcript can tag "Speaker 1"/
"Speaker 2" turns instead of one undifferentiated block of text — useful since
a single ambient mic picks up both the doctor and the patient. This is turn-level
(per audio chunk), not word-level, and uses neutral labels rather than guessing
which speaker is the doctor vs. the patient (that's for the clinician to confirm).
"""
from __future__ import annotations

import tempfile
import os

from app.core.config import settings

_MODEL = None
_SPEAKER_MODEL = None
# Per-encounter running speaker-embedding centroids: {encounter_id: [(label, embedding, count), ...]}
_SPEAKER_CENTROIDS: dict[str, list] = {}
_MAX_SPEAKERS = 4
# Calibrated empirically against ECAPA cosine similarities (not the ~0.7+ people often assume):
# same speaker, different sentence ~0.55; different speakers ~0.25. 0.40 sits well between the
# two, biased slightly toward recognizing the same speaker again since real (noisier, shorter)
# mic chunks tend to score a bit lower than clean synthetic test clips.
_SPEAKER_SIMILARITY_THRESHOLD = 0.40


def _get_model():
    """Lazy-load the Whisper ASR model (first call only — avoids slowing backend boot)."""
    global _MODEL
    if _MODEL is None:
        try:
            from faster_whisper import WhisperModel
            print(f"[Whisper ASR] Loading local speech-to-text model '{settings.whisper_model_size}'…")
            _MODEL = WhisperModel(settings.whisper_model_size, device="cpu", compute_type="int8")
            print("[Whisper ASR] Model loaded — ambient dictation is ready.")
        except Exception as err:  # pragma: no cover - defensive, mirrors local_analyzer.py pattern
            print(f"[Whisper ASR] Warning loading model: {err}")
            _MODEL = None
    return _MODEL


def _get_speaker_model():
    """Lazy-load the speechbrain ECAPA speaker-embedding model (fully offline after first download)."""
    global _SPEAKER_MODEL
    if _SPEAKER_MODEL is None:
        try:
            from speechbrain.inference.speaker import EncoderClassifier
            print("[Speaker ID] Loading local speaker-embedding model…")
            _SPEAKER_MODEL = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=os.path.join(tempfile.gettempdir(), "spkrec-ecapa"),
            )
            print("[Speaker ID] Model loaded — speaker labels are ready.")
        except Exception as err:  # pragma: no cover - defensive
            print(f"[Speaker ID] Warning loading model: {err}")
            _SPEAKER_MODEL = False  # sentinel: tried and failed, don't retry every chunk
    return _SPEAKER_MODEL or None


def _label_speaker(encounter_id: str, wav_path: str) -> str | None:
    """Return a stable "Speaker N" label for this audio chunk, clustering by voice similarity
    against previously-seen speakers in this same encounter. Best-effort — returns None (no
    label) if the speaker model isn't available or the clip is too short to embed reliably."""
    model = _get_speaker_model()
    if model is None:
        return None
    try:
        import torch
        import torchaudio

        wav, sr = torchaudio.load(wav_path)
        if wav.shape[0] > 1:
            wav = wav.mean(dim=0, keepdim=True)
        if sr != 16000:
            wav = torchaudio.functional.resample(wav, sr, 16000)
        if wav.shape[1] < 1600:  # shorter than ~0.1s — not enough signal to embed usefully
            return None
        with torch.no_grad():
            embedding = model.encode_batch(wav).squeeze().numpy()
    except Exception as err:  # pragma: no cover - defensive
        print(f"[Speaker ID] Warning embedding audio: {err}")
        return None

    import numpy as np

    centroids = _SPEAKER_CENTROIDS.setdefault(encounter_id, [])
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return None
    embedding = embedding / norm

    best_label, best_sim, best_idx = None, -1.0, -1
    for idx, (label, centroid, _count) in enumerate(centroids):
        sim = float(np.dot(embedding, centroid))
        if sim > best_sim:
            best_label, best_sim, best_idx = label, sim, idx

    if best_sim >= _SPEAKER_SIMILARITY_THRESHOLD or len(centroids) >= _MAX_SPEAKERS:
        # Match found (or we've hit the speaker cap) — update that speaker's running centroid.
        label, centroid, count = centroids[best_idx]
        new_count = count + 1
        new_centroid = (centroid * count + embedding) / new_count
        new_centroid = new_centroid / np.linalg.norm(new_centroid)
        centroids[best_idx] = (label, new_centroid, new_count)
        return label

    # New speaker.
    label = f"Speaker {len(centroids) + 1}"
    centroids.append((label, embedding, 1))
    return label


def reset_speakers(encounter_id: str) -> None:
    """Clear the remembered speaker voices for an encounter (e.g. when a new consultation starts)."""
    _SPEAKER_CENTROIDS.pop(encounter_id, None)


def transcribe_audio(
    data: bytes,
    suffix: str = ".webm",
    language: str | None = "en",
    encounter_id: str | None = None,
) -> dict:
    """Transcribe a short consultation audio clip fully offline and (best-effort) tag which
    speaker said it. Returns {"text": str, "speaker": str | None} — speaker is None if the
    diarization model isn't available or the clip couldn't be reliably embedded."""
    if not data:
        return {"text": "", "speaker": None}
    model = _get_model()
    if model is None:
        raise RuntimeError("Speech-to-text model is unavailable on this server.")
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(data)
        tmp.close()  # release python file lock on Windows
        segments, _info = model.transcribe(
            tmp.name,
            language=language,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            condition_on_previous_text=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=600,
                speech_pad_ms=400,
                threshold=0.35,
            ),
        )
        text = " ".join(seg.text.strip() for seg in segments if seg.text.strip()).strip()
        speaker = _label_speaker(encounter_id, tmp.name) if text and encounter_id else None
        # Return Whisper's detected language (available even in auto-detect mode) so the
        # frontend can display and lock in the language for subsequent chunks.
        detected_language = _info.language if _info and hasattr(_info, "language") else None
        return {"text": text, "speaker": speaker, "detected_language": detected_language}
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
