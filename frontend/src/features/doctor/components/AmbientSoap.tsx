import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, CheckCircle2, BadgeCheck, Sparkles, Languages, AlertTriangle, ShieldAlert } from "lucide-react";
import { api } from "../../../lib/api";
import { Card, Wave, Empty, AgentBadge, Tag } from "../../../components/ui";

interface AmbientSoapProps {
  encounterId: string;
  doctorName?: string | null;
}

// Ambient listening records short, complete audio clips (stop+restart the recorder every
// CHUNK_MS) and sends each clip to the backend, which transcribes it locally with Whisper
// ("small" model + tuned voice-activity detection, offline — audio never leaves the server)
// and tags it with a best-effort "Speaker N" label (offline speaker-embedding diarization).
// This is more reliable than the browser's built-in Web Speech API, which streams raw audio
// to Google's servers and silently stops working if that endpoint is unreachable (common on
// hospital/corporate networks). CHUNK_MS is short to keep the delay between speaking and
// seeing text on screen as low as practical for a batch (not truly streaming) ASR pipeline.
const CHUNK_MS = 3000;

// Whisper is inherently multi-lingual — this lets the doctor tell it which language the
// consultation is happening in (big accuracy win over guessing) or fall back to auto-detect
// for mixed/code-switched conversations, which are common in Indian outpatient settings.
const AMBIENT_LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
  { code: "ur", label: "Urdu" },
  { code: "or", label: "Odia" },
  { code: "as", label: "Assamese" },
  { code: "ne", label: "Nepali" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese (Mandarin)" },
];

// ─── Offline Unicode-range language detector ──────────────────────────────
// Detects script/language from character Unicode ranges with zero network calls.
// Returns a Whisper/BCP-47 language code or null if insufficient non-ASCII signal.
function detectLangFromText(text: string): string | null {
  const sample = text.slice(-120); // use the most recent portion for fresh detection
  let devanagari = 0, arabic = 0, tamil = 0, telugu = 0, bengali = 0,
      kannada = 0, malayalam = 0, gujarati = 0, gurmukhi = 0,
      chinese = 0, latin = 0, other = 0;

  for (const ch of sample) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x0600 && cp <= 0x06FF) arabic++;
    else if (cp >= 0x0B80 && cp <= 0x0BFF) tamil++;
    else if (cp >= 0x0C00 && cp <= 0x0C7F) telugu++;
    else if (cp >= 0x0980 && cp <= 0x09FF) bengali++;
    else if (cp >= 0x0C80 && cp <= 0x0CFF) kannada++;
    else if (cp >= 0x0D00 && cp <= 0x0D7F) malayalam++;
    else if (cp >= 0x0A80 && cp <= 0x0AFF) gujarati++;
    else if (cp >= 0x0A00 && cp <= 0x0A7F) gurmukhi++;
    else if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF)) chinese++;
    else if ((cp >= 0x0041 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F)) latin++;
    else if (cp > 127) other++;
  }

  const scriptTotal = devanagari + arabic + tamil + telugu + bengali +
    kannada + malayalam + gujarati + gurmukhi + chinese;

  if (scriptTotal < 4) return null; // not enough non-ASCII to be confident

  const scores: [number, string][] = [
    [devanagari, "hi"], // Devanagari covers Hindi, Marathi, Nepali — pick Hindi as default
    [arabic, "ur"],
    [tamil, "ta"],
    [telugu, "te"],
    [bengali, "bn"],
    [kannada, "kn"],
    [malayalam, "ml"],
    [gujarati, "gu"],
    [gurmukhi, "pa"],
    [chinese, "zh"],
  ];

  scores.sort((a, b) => b[0] - a[0]);
  const [topScore, topLang] = scores[0];
  if (topScore === 0) return null;

  // Refine Devanagari script — distinguish Hindi/Marathi/Nepali by vocabulary
  if (topLang === "hi") {
    const t = text.toLowerCase();
    if (/\b(आहे|आहात|मराठी|मला|तुम्ही)\b/.test(t)) return "mr";
    if (/\b(छ|छन्|नेपाल|हुन्छ|गर्नु)\b/.test(t)) return "ne";
  }
  // Refine Arabic script — Urdu vs Arabic
  if (topLang === "ur") {
    if (/[\u0600-\u06FF]/.test(text) && !/[\u0750-\u077F\u0600-\u060F]/.test(text)) return "ur";
    return "ar";
  }

  return topLang;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

// Languages the doctor can request a translated *view* of the SOAP draft in — no "auto" here
// since a translation always needs one concrete target language.
const VIEW_LANGUAGES = AMBIENT_LANGUAGES.filter((l) => l.code !== "auto");

export default function AmbientSoap({ encounterId, doctorName }: AmbientSoapProps) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [finalText, setFinalText] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [language, setLanguage] = useState("en");
  const languageRef = useRef(language);
  languageRef.current = language;

  // Doctor-side translated *view* of the SOAP draft — e.g. an English SOAP note the doctor
  // wants to read back in Hindi/Tamil for the patient. Reference only: never touches finalText,
  // so the approved clinical record always stays exactly what the doctor reviewed and approved.
  const [viewLanguage, setViewLanguage] = useState("en");
  const [translatedSoap, setTranslatedSoap] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  const [useLocalWhisper, setUseLocalWhisper] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const detectedLangRef = useRef<string | null>(null);
  const langSwitchPendingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const committedTextRef = useRef("");
  const interimTextRef = useRef("");
  const chunkSeqRef = useRef(0);
  const nextToAppendRef = useRef(0);
  const pendingResultsRef = useRef<Map<number, { text: string; speaker: string | null }>>(new Map());
  const inFlightRef = useRef(0);
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function appendInOrder(index: number, text: string, speaker: string | null) {
    pendingResultsRef.current.set(index, { text, speaker });
    while (pendingResultsRef.current.has(nextToAppendRef.current)) {
      const chunk = pendingResultsRef.current.get(nextToAppendRef.current)!;
      pendingResultsRef.current.delete(nextToAppendRef.current);
      nextToAppendRef.current += 1;
      if (chunk.text.trim()) {
        setTranscript((prev) => {
          const cleanText = chunk.text.trim();
          const line = chunk.speaker ? `${chunk.speaker}: ${cleanText}` : cleanText;
          // Start a new line per speaker turn instead of running everything together, so the
          // doctor/patient turns stay visually distinguishable in the plain-text transcript.
          if (!prev) return line;
          const lastLine = prev.split("\n").pop() || "";
          const sameSpeaker = chunk.speaker && lastLine.startsWith(`${chunk.speaker}: `);
          return sameSpeaker ? `${prev} ${cleanText}` : `${prev}\n${line}`;
        });
      }
    }
  }

  async function uploadChunk(index: number, blob: Blob, mimeType: string) {
    inFlightRef.current += 1;
    setTranscribing(true);
    try {
      const ext = mimeType.includes("ogg") ? "ogg" : "webm";
      const result = await api.ambientTranscribeAudio(encounterId, blob, `chunk-${index}.${ext}`, languageRef.current);
      const { text, speaker } = result;
      // Whisper returns the language it detected — show it in the UI and lock in for subsequent chunks
      const wLang: string | undefined = (result as any).detected_language;
      if (wLang && languageRef.current === "auto" && wLang !== detectedLangRef.current) {
        detectedLangRef.current = wLang;
        setDetectedLang(wLang);
      }
      appendInOrder(index, text || "", speaker ?? null);
    } catch {
      appendInOrder(index, "", null); // drop a failed chunk rather than stall ordering
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) setTranscribing(false);
    }
  }

  async function recordNextChunk(stream: MediaStream, mimeType: string, retry = 0) {
    if (!listeningRef.current) return;
    const parts: BlobPart[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();
      await new Promise((r) => setTimeout(r, CHUNK_MS));
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
    } catch {
      // Some browsers occasionally fail to (re)start a MediaRecorder on a live stream —
      // back off briefly and retry a few times before giving up on this listening session.
      if (listeningRef.current && retry < 5) {
        await new Promise((r) => setTimeout(r, 300));
        return recordNextChunk(stream, mimeType, retry + 1);
      }
      if (listeningRef.current) {
        setMicError("Ambient listening was interrupted — please click \"Start listening\" again.");
        stopListening();
      }
      return;
    }

    if (listeningRef.current) {
      // Kick off the next recording immediately so there's minimal gap in the "ambient" capture.
      recordNextChunk(stream, mimeType);
    }
    if (parts.length) {
      const blob = new Blob(parts, { type: recorder.mimeType || mimeType });
      if (blob.size > 800) {
        const index = chunkSeqRef.current++;
        uploadChunk(index, blob, recorder.mimeType || mimeType);
      }
    }
  }

  function getLangCode(lang: string): string {
    const map: Record<string, string> = {
      auto: "en-US", en: "en-US", hi: "hi-IN", ta: "ta-IN", te: "te-IN",
      bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN",
      pa: "pa-IN", ur: "ur-PK", ar: "ar-SA", fr: "fr-FR", es: "es-ES",
      zh: "zh-CN", ne: "ne-NP", or: "or-IN", as: "as-IN",
    };
    return map[lang] ?? lang;
  }

  function startWebSpeechListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError("Real-time Web Speech API is not supported in this browser. Please use Chrome/Edge or toggle on 'Offline Whisper'.");
      return;
    }
    setMicError(null);

    // Seed committed text from whatever's already in the textarea so manual edits are preserved
    committedTextRef.current = transcript;
    interimTextRef.current = "";

    function createRecognition() {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      // If we've already detected a language, use it for better accuracy
      const effectiveLang = (languageRef.current === "auto" && detectedLangRef.current)
        ? detectedLangRef.current
        : languageRef.current;
      rec.lang = getLangCode(effectiveLang);

      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            const word = result[0].transcript;
            committedTextRef.current = committedTextRef.current
              ? committedTextRef.current + " " + word
              : word;
            interimTextRef.current = "";
          } else {
            interim += result[0].transcript;
          }
        }
        interimTextRef.current = interim;
        const full = interim
          ? committedTextRef.current + (committedTextRef.current ? " " : "") + interim
          : committedTextRef.current;
        setTranscript(full);

        // ── Auto language detection via Unicode ranges (100% offline) ──
        // Only runs when user has selected "Auto-detect"
        if (languageRef.current === "auto" && !langSwitchPendingRef.current) {
          const accumulated = committedTextRef.current + " " + interim;
          if (accumulated.trim().length > 15) {
            const detected = detectLangFromText(accumulated);
            if (detected && detected !== detectedLangRef.current) {
              detectedLangRef.current = detected;
              setDetectedLang(detected);
              // Restart recognition with detected language for higher accuracy
              langSwitchPendingRef.current = true;
              setTimeout(() => {
                if (listeningRef.current) {
                  try { recognitionRef.current?.stop(); } catch {}
                }
                langSwitchPendingRef.current = false;
              }, 200);
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setMicError("Microphone access denied — please allow mic permission and try again.");
          listeningRef.current = false;
          setListening(false);
        } else if (e.error === "network") {
          // Web Speech needs Google's servers — stop looping and switch to offline Whisper
          listeningRef.current = false;
          setListening(false);
          setUseLocalWhisper(true);
          setMicError("Web Speech API needs internet (Google). Switched to Offline Whisper Mode automatically — click Start listening again.");
        } else if (e.error === "no-speech") {
          // not an error — silence detected, auto-restarts via onend
        } else if (e.error === "aborted") {
          // intentional stop — ignore
        }
      };

      rec.onend = () => {
        // Commit any dangling interim text when recognition ends mid-sentence
        if (interimTextRef.current.trim()) {
          committedTextRef.current = committedTextRef.current
            ? committedTextRef.current + " " + interimTextRef.current.trim()
            : interimTextRef.current.trim();
          interimTextRef.current = "";
          setTranscript(committedTextRef.current);
        }
        // Auto-restart as long as the session is still active
        if (listeningRef.current) {
          try {
            // Small delay avoids a DOMException on rapid restart in some browsers
            setTimeout(() => {
              if (listeningRef.current) {
                recognitionRef.current = createRecognition();
                recognitionRef.current.start();
              }
            }, 150);
          } catch (err) {
            console.error("[WebSpeech] restart failed:", err);
          }
        }
      };

      return rec;
    }

    // Reset detection state on new session start
    detectedLangRef.current = null;
    langSwitchPendingRef.current = false;
    if (languageRef.current !== "auto") setDetectedLang(null);
    listeningRef.current = true;
    setListening(true);
    recognitionRef.current = createRecognition();
    recognitionRef.current.start();
  }

  async function startListening() {
    if (!supported) {
      setMicError("Live listening needs a modern browser (Chrome, Edge, Firefox) with microphone support.");
      return;
    }
    setMicError(null);
    if (!useLocalWhisper) {
      startWebSpeechListening();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      chunkSeqRef.current = 0;
      nextToAppendRef.current = 0;
      pendingResultsRef.current.clear();
      api.ambientResetSpeakers(encounterId).catch(() => {}); // fresh voice clustering for this session
      listeningRef.current = true;
      setListening(true);
      recordNextChunk(stream, mimeType);
    } catch {
      setMicError("Microphone access denied — allow mic permission to use ambient listening.");
    }
  }

  function stopListening() {
    listeningRef.current = false;
    langSwitchPendingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setListening(false);
  }

  async function generate() {
    setBusy(true); 
    setApproved(false);
    setViewLanguage("en");
    setTranslatedSoap(null);
    setTranslateError(false);
    try {
      const r = await api.ambient(encounterId, transcript);
      setDraft(r); 
      setFinalText(r.result.draft_text);
    } finally { 
      setBusy(false); 
    }
  }

  async function viewInLanguage(lang: string, soap: any) {
    setViewLanguage(lang);
    setTranslateError(false);
    if (lang === "en" || !soap) {
      setTranslatedSoap(null);
      return;
    }
    // TODO: Implement translation endpoint (api.translateText) in backend
    // For now, show original text in English
    setTranslatedSoap(null);
  }

  async function approve() {
    setBusy(true);
    try {
      await api.approveNote(draft.note_id, { final_text: finalText, icd10_codes: draft.result.icd10, approved_by: doctorName || "Attending Doctor" });
      setApproved(true);
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 animate-in fade-in duration-300">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-bold text-slate-100">Consultation transcript</h4>
          <span className="flex items-center gap-2">
            <Wave recording={listening} />
            <span className="live" style={{ opacity: listening ? 1 : 0.45 }}>{listening ? "LISTENING" : "IDLE"}</span>
            {listening && language === "auto" && detectedLang && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(6,182,212,0.15)", color: "var(--cyan)", border: "1px solid rgba(6,182,212,0.3)" }}>
                🌐 {AMBIENT_LANGUAGES.find(l => l.code === detectedLang)?.label ?? detectedLang}
              </span>
            )}
          </span>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Languages size={14} style={{ color: "var(--dim)" }} />
            <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Consultation language</label>
            <select
              className="input text-xs select"
              style={{ width: "auto", flex: "none" }}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {AMBIENT_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={useLocalWhisper}
              onChange={(e) => {
                if (listening) {
                  alert("Please stop the current listening session before changing speech engine mode.");
                  return;
                }
                setUseLocalWhisper(e.target.checked);
              }}
            />
            <span>Offline Whisper Mode</span>
          </label>
        </div>
        <textarea
          className="input"
          rows={7}
          placeholder="Type, paste, or click “Start listening” to dictate the consultation live…"
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            // Keep committed ref in sync so Web Speech restarts don't overwrite manual edits
            committedTextRef.current = e.target.value;
            interimTextRef.current = "";
          }}
        />
        {listening && (
          <div className="mt-1 text-[12.5px] italic" style={{ color: "var(--dim)" }}>
            {useLocalWhisper ? (
              transcribing ? "Transcribing the last few seconds…" : "Listening offline — speak naturally, text appears every few seconds."
            ) : language === "auto" ? (
              detectedLang
                ? `Auto-detected: ${AMBIENT_LANGUAGES.find(l => l.code === detectedLang)?.label ?? detectedLang} — recognition switched for higher accuracy.`
                : "Auto-detect active — speak naturally, language will be detected from your speech."
            ) : (
              "Listening real-time — speak naturally, words appear immediately."
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={listening ? "btn danger" : "btn"}
            onClick={listening ? stopListening : startListening}
          >
            {listening ? (<><MicOff size={15} /> Stop listening</>) : (<><Mic size={15} /> Start listening</>)}
          </button>
          <button className="btn ghost" style={{ flex: 1 }} disabled={busy || !transcript.trim()} onClick={generate}>
            <Sparkles size={15} /> {busy ? "Transcribing…" : "Generate SOAP draft"}
          </button>
        </div>
        {micError && (
          <div className="mt-2 text-[12px]" style={{ color: "var(--red)" }}>{micError}</div>
        )}
        {!supported && !micError && (
          <div className="mt-2 text-[12px]" style={{ color: "var(--dim)" }}>
            Live speech-to-text needs microphone support in this browser — you can still type or paste the transcript.
          </div>
        )}
      </Card>
      <Card>
        {!draft ? <Empty>A SOAP note draft will appear here — you approve before it's committed.</Empty> : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100">SOAP draft</h4>
              <AgentBadge label="Draft — needs approval" />
            </div>
            {(draft.result.red_flags?.length > 0 || draft.result.abnormal_vitals?.length > 0) && (
              <div className="mb-2 rounded-lg border border-rose-500/40 bg-rose-950/20 p-2 text-[12px] text-rose-300">
                <div className="mb-1 flex items-center gap-1.5 font-bold"><ShieldAlert size={13} /> Safety signals detected — review before approving</div>
                {draft.result.red_flags?.length > 0 && (
                  <div>⚠ Red-flag keyword(s) in transcript: {draft.result.red_flags.join("; ")}</div>
                )}
                {draft.result.abnormal_vitals?.length > 0 && (
                  <div>⚠ Abnormal vitals: {draft.result.abnormal_vitals.join("; ")}</div>
                )}
              </div>
            )}
            <div className="holo whitespace-pre-wrap text-[13px] text-slate-200">
              <div><b>S:</b> {draft.result.soap.S}</div>
              <div><b>O:</b> {draft.result.soap.O}</div>
              <div><b>A:</b> {draft.result.soap.A}</div>
              <div><b>P:</b> {draft.result.soap.P}</div>
            </div>
            {draft.result.allergies_considered?.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px]" style={{ color: "var(--dim)" }}>
                <AlertTriangle size={11} /> Grounded with known allergies: {draft.result.allergies_considered.join(", ")}
              </div>
            )}
            <div className="mb-2 flex items-center gap-2">
              <Languages size={14} style={{ color: "var(--dim)" }} />
              <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>View in</label>
              <select
                className="input text-xs select"
                style={{ width: "auto", flex: "none" }}
                value={viewLanguage}
                onChange={(e) => viewInLanguage(e.target.value, draft.result.soap)}
              >
                {VIEW_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            {viewLanguage !== "en" && (
              <div className="mb-2 rounded-lg border p-2 text-[12.5px] whitespace-pre-wrap" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>
                  Translated view · reference only — not part of the approved record
                </div>
                {translating
                  ? "Translating…"
                  : translateError
                  ? "Translation is unavailable right now (AI service offline) — showing the original English note above."
                  : translatedSoap}
              </div>
            )}
            <div className="my-2 flex flex-wrap gap-1">
              {draft.result.icd10.map((c: any) => <Tag key={c.code} tone="blue">{c.code} · {c.label}</Tag>)}
            </div>
            <textarea className="input" rows={4} value={finalText} onChange={(e) => setFinalText(e.target.value)} />
            {approved ? (
              <div className="mt-2 flex items-center gap-2" style={{ color: "var(--mint)" }}><CheckCircle2 size={16} /> Note approved &amp; committed.</div>
            ) : (
              <button className="btn g mt-3 w-full" disabled={busy} onClick={approve}><BadgeCheck size={16} /> Approve note</button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
