# Sarjy — Voice AI Assistant
### Presentation Brief · March 2026

---

## What Is Sarjy?

Sarjy is a voice-first AI assistant built on a fully custom stack. It understands natural speech, executes real-world actions through tool integrations, and remembers users across sessions.
It is deployed as a web app with Google OAuth sign-in, and is accessible from any browser on desktop or mobile. No push-to-talk. No app install. Just speak.

---

## The Full Voice Loop

```
Mic → VAD (Silero) → STT (Groq Whisper) → LLM (Claude Haiku, streaming)
  → Tool execution → TTS (ElevenLabs, sentence-streaming) → Audio playback
```

Every step is optimised for latency. The user never presses a button — speech detection is fully automatic via a WebAssembly neural network running directly in the browser.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15, React 19, Tailwind, Framer Motion | App Router, RSC |
| VAD | Silero VAD v5 (ONNX, AudioWorklet) | Auto speech detection, browser-native |
| STT | Groq Whisper large-v3-turbo | ~300 ms, 90+ languages |
| LLM | Claude Haiku 4.5 (streaming + tool use) | SSE stream, multi-turn |
| TTS | ElevenLabs eleven_turbo_v2_5 | Sentence-level streaming, ~300 ms first chunk |
| Auth | NextAuth + Google OAuth | Scoped to Calendar + Drive |
| Short memory | Upstash Redis | Last 20 messages, 24 h TTL |
| Long memory | Supabase Postgres (RLS) | Persistent key/value facts |
| Guardrails | Llama Guard 3 8B (Groq) | Pre-LLM safety check |
| Telephony | Twilio (TwiML webhook) | Inbound calls via real phone number |
| Deploy | Vercel | Edge-compatible routes, 60 s max duration |

---

## Features Built

### 1. Automatic Speech Detection (VAD)
The Silero VAD model runs inside a Web AudioWorklet — a background thread in the browser. It detects when the user starts and stops speaking, with ~200 ms precision, without any server round-trip. Clips under 0.5 s are discarded to avoid noise triggers.

### 2. Sub-Second Transcription (STT)
Speech is encoded as a WAV blob and sent to Groq's Whisper large-v3-turbo endpoint. Average turnaround is ~300 ms for a sentence. The response includes the detected language code, enabling automatic language mirroring.

### 3. Multilingual Support
If the user speaks any of 90+ supported languages, Sarjy detects it from the transcription and instructs Claude to reply in the same language. No configuration required.

### 4. Streaming LLM with Tool Use (Claude Haiku)
The chat route opens a Server-Sent Events stream. Claude's response arrives as a token stream — the UI shows text being written in real time. When Claude invokes a tool, the stream emits a `tool_start` event (badge appears in transcript), executes the tool server-side, then emits a `tool_result` event before continuing the text stream. All of this happens within a single HTTP connection.

### 5. Sentence-Level Streaming TTS
Rather than waiting for a full response before sending to ElevenLabs, Sarjy splits the text at sentence boundaries and streams TTS audio chunk by chunk. First audio chunk plays within ~300 ms of the first sentence being generated, reducing total perceived latency from ~2.7 s to ~800 ms.

### 6. Barge-In / Interrupt
If the user starts speaking while Sarjy is still talking, the VAD fires immediately. The audio player stops mid-sentence, the current response is discarded, and Sarjy transitions to listening within one animation frame. This is the behaviour users expect from a natural conversation.

### 7. Two-Tier Memory
| Layer | Store | Duration | Content |
|---|---|---|---|
| Short-term | Upstash Redis | 24 hours | Last 20 messages (full dialogue history) |
| Long-term | Supabase Postgres | Permanent | Named facts: preferences, todos, reminders |

When Claude learns something worth keeping (your name, coffee order, current project), it calls `save_memory` silently. The fact immediately appears in the Memory Panel. On the next session — or after a page reload — Claude greets you with full context of who you are.

### 8. Memory Panel
A slide-out drawer on the right side of the app. Shows all saved facts grouped by category (preference / fact / todo / reminder). Each fact has a delete button. A "Clear conversation" button wipes both the Redis history and all Supabase facts for the session.

### 9. AI Tools (8 total)

| Tool | What it does |
|---|---|
| `save_memory` | Persists a fact to Supabase for the current user |
| `delete_memory` | Removes a saved fact by key |
| `get_weather` | Queries OpenWeatherMap and returns current conditions in °F/°C |
| `web_search` | Tavily deep-search with answer summary — only returns facts from sources, no hallucination |
| `get_calendar_events` | Reads upcoming events from the user's Google Calendar (OAuth scoped) |
| `send_slack_message` | Sends a message to a team Slack channel via webhook |
| `search_drive` | Full-text search across the user's Google Drive files |
| `find_flights` | Tavily-powered flight search with route, date, and cabin class |

Every tool call is visible to the user as a badge in the transcript. Tool results are always injected back into Claude's context — it will never claim it cannot see information that was returned.

### 10. Animated Talking Avatar
An SVG face replaces the abstract waveform orb. It has:
- **Lip-sync**: mouth shape driven by Web Audio `AnalyserNode` amplitude at 60 fps, directly mutating the SVG DOM via `requestAnimationFrame` (bypassing React for performance)
- **Blinking**: randomised blink every 2.8–5 s via direct DOM mutation
- **Expressive states**: eyebrows raise when listening, pupils shift upward-left when thinking
- **State rings**: purple ping ring (listening), spinning conic gradient (thinking), red pulse (error)

### 11. Guardrails (Llama Guard)
Before every user message reaches Claude, it is checked by Llama Guard 3 8B running on Groq. If the content is flagged as unsafe, Sarjy returns a polite refusal and never calls Claude. The guard fails open (if the guard itself errors, the request continues) to avoid false positives blocking legitimate use.

### 12. Multimodal: Image + Voice
Users can attach an image to a voice query. The frontend encodes it as base64 and sends it alongside the transcript to `/api/chat`. Claude Haiku's vision capability processes image + text together and delivers a spoken answer. Demo: photograph a menu and ask "what should I order?"

### 13. Telephony via Twilio
Sarjy has a real phone number. Incoming calls hit a Twilio TwiML webhook (`/api/twilio/voice`), which greets the caller and redirects speech to `/api/twilio/gather`. The gather endpoint runs the same STT → LLM → TTS pipeline and speaks the response back. No browser required — the full assistant is available by phone.

### 14. Guided Multi-Step Workflows

**Personality Assessment** — triggered by "what's my personality?" Sarjy walks through exactly 5 questions, one at a time (how you recharge, planning style, decision-making, deadline habits, team strength), then summarises the likely MBTI type and saves it as a memory fact.

**Symptom Intake** — triggered by describing health symptoms. Sarjy conducts a structured 4-step intake (chief complaint, duration, severity, associated symptoms), gives a brief summary, and saves key findings. Reminds the user to consult a doctor.

Both workflows are defined entirely in the system prompt — no extra code paths, no state machines.

### 15. Google OAuth + Scoped Permissions
Sign-in grants access to Google Calendar and Google Drive in addition to basic profile. The OAuth access token is passed through the session to server-side API routes, so tool calls can act on behalf of the user with their real data.

### 16. Animated UI (Framer Motion)
- VoiceOrb / TalkingAvatar transitions between all 5 states (idle, listening, thinking, speaking, error) with spring physics
- Transcript messages slide in with `AnimatePresence`
- Memory panel slides in from the right
- Status bar label fades between state names
- All transitions are under 250 ms

### 17. PWA (Progressive Web App)
A `manifest.json` makes the app installable on mobile home screens. The VAD's AudioWorklet requires HTTPS, which Vercel provides. No separate mobile build needed.

---

## SSE Event Protocol

The chat endpoint streams Server-Sent Events to the client:

```
data: {"type":"text","delta":"The weather in London"}
data: {"type":"tool_start","name":"get_weather"}
data: {"type":"tool_result","name":"get_weather","result":"London, GB: 54°F (12°C)..."}
data: {"type":"text","delta":" is 54°F and cloudy."}
data: {"type":"done"}
```

The client uses a line-buffer strategy to handle partial SSE chunks without parse errors.

---

## Performance Numbers

| Step | Latency |
|---|---|
| VAD detection | ~200 ms |
| Groq Whisper STT | ~300 ms |
| Claude Haiku first token | ~400 ms |
| ElevenLabs first audio chunk (sentence streaming) | ~300 ms |
| **Total to first spoken word** | **~800 ms** |

Without sentence streaming, total latency would be ~2.7 s (waiting for full response before TTS).

---

## Cost Model

Costs per single voice exchange (one user turn + one spoken response):

| Component | Rate | Per exchange |
|---|---|---|
| Claude Haiku 4.5 | $1/MTok in · $5/MTok out | ~$0.0016 |
| Groq Whisper large-v3-turbo | $0.111/hr audio | ~$0.00015 |
| ElevenLabs Flash/Turbo TTS | $0.06/1K chars | ~$0.006 |
| **Total** | | **~$0.008 / exchange** |

A typical 3-turn conversation costs **~$0.02–$0.025**. TTS is the dominant cost (~75%).

At 1,000 daily active users (10 conversations/day): ~$200–$250/day. The primary scaling lever is replacing ElevenLabs with a self-hosted TTS model (e.g. Kokoro), which reduces TTS cost by ~90% and brings per-conversation cost under $0.003.

---

## What Was Built (Summary)

- Custom voice pipeline: VAD → STT → LLM (streaming) → TTS (sentence streaming)
- Barge-in interrupt mid-speech
- Multilingual auto-detection and mirroring
- Two-tier persistent memory (Redis + Postgres)
- 8 live tools: weather, web search, Google Calendar, Google Drive, Slack, flight search, save/delete memory
- Llama Guard safety layer
- Multimodal image + voice input
- Animated SVG talking avatar with lip-sync via AnalyserNode
- Guided multi-step workflows (personality assessment, symptom intake) via prompt engineering
- Twilio telephony (real phone number)
- Google OAuth with Calendar and Drive scopes
- Deployed on Vercel with PWA manifest

**~$0.02 per 3-turn conversation. ~800 ms to first spoken word.**
