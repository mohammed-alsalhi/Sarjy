# Day 3 — Session Summary (2026-03-22)

## Talking Avatar
- Created `TalkingAvatar.tsx` — SVG face component replacing the `VoiceOrb` as the main UI element
- Lip-sync driven by AnalyserNode frequency data via `requestAnimationFrame` with direct DOM ref manipulation (no React re-renders during speech)
- Periodic blinking via `setTimeout` with direct DOM manipulation on eye ellipses
- Eyebrow raise when listening, pupils shift up-left when thinking
- All existing state rings preserved (ping for listening, spinning gradient for thinking, pulse for error)
- Fixed Vercel build type error: `Uint8Array<ArrayBufferLike>` cast to `Uint8Array<ArrayBuffer>`

## Bug Fixes

### Weather tool (get_weather)
- Was calling `/api/weather` internally — that route requires a session cookie, so server-to-server calls got 401
- Fixed: call OpenWeatherMap directly from the chat route, same as the weather route does

### Barge-in interrupt not submitting
- After interrupting TTS and speaking, the audio was silently dropped
- Root cause: `onSpeechEnd` gates on `activeRef.current`, but the barge-in path never set it to `true`
- Fixed: added `activeRef.current = true` in `onSpeechStart` when a barge-in is detected

### Image upload not working (multimodal)
- Uploaded images showed in the transcript but Claude said it couldn't see them
- Root cause 1: `pendingImageRef` was synced via `useEffect` (async, fires after paint) — could be stale if user spoke quickly after uploading
- Root cause 2: `sendMessage` itself was a stale closure captured by `onSpeechEnd` at VAD init time — always read `pendingImage = null` from the first render
- Fixed:
  - Replaced `useEffect` sync with a synchronous `setPendingImage` wrapper that updates both state and ref immediately
  - Added `sendMessageRef` — updated synchronously on every render; `onSpeechEnd` now calls `sendMessageRef.current(...)` instead of the stale `sendMessage` directly

### Web search hallucinations
- Switched Tavily from `search_depth: "basic"` to `"advanced"` — fetches actual page content instead of snippets
- Added `include_answer: true` — Tavily's own summary prepended as a grounding anchor
- Included URLs in results so Claude can cite sources
- Added system prompt rule: only report facts explicitly in search results, never supplement with training data

### Flight search
- Same shallow search issues as web search — applied identical fixes (advanced depth, include_answer, URLs)

### Claude pre-announcing tool calls
- Claude was saying "Let me send that to Slack now…" before the tool executed and then discovering Slack wasn't configured
- Fixed: added system prompt instruction to never narrate tool calls before executing them

### Claude ignoring tool result data
- After `search_drive` returned file URLs, Claude told the user it didn't have access to URLs
- Fixed: added system prompt instruction to always use data returned by tools, never claim missing info that was in a tool result

### Slack not configured
- `SLACK_WEBHOOK_URL` was missing from `.env.local` (only in `.env.example`)
- Added the real webhook URL; confirmed it works (HTTP 200)
- Reminder: Vercel requires a redeploy after adding env vars for them to take effect

### Transcript text overflow
- Long URLs from Drive/search results were overflowing message bubbles
- Fixed: added `break-words` Tailwind class to the bubble `<p>` element

### Unused variable lint warning
- Removed unused `start` variable in the calendar events map in `chat/route.ts`

## Telephony (Twilio)
- Added `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` to `.env.local`
- Refactored `.env.local`: removed unused `GEMINI_API_KEY`, deduplicated Slack var, added Telephony section, removed unnecessary quotes from Redis vars
- Twilio webhook must be POST, pointed at `/api/twilio/voice`
- Calls were failing because `NEXTAUTH_URL=http://localhost:3000` — Twilio couldn't reach localhost, causing 405 on `/api/twilio/gather`
- Fixed: set `NEXTAUTH_URL=https://sarjy-blush.vercel.app` (no trailing slash) in Vercel env vars and redeployed
- Double slash bug (`//api/twilio/gather`) was caused by a trailing slash on `NEXTAUTH_URL`
