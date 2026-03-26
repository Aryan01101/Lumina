# Lumina — AI Desktop Companion
## Product Requirements Document — v3.0 (Locked MVP)

**Author:** Aryan Adhikari
**Version:** 3.0 — Final MVP Scope
**Status:** LOCKED — Ready to Build
**Supersedes:** v1.0, v2.0 (scoped down per senior engineering review)
**Target Platform:** macOS 13+, Windows 10/11
**Build Timeline:** 8 Weeks Part-Time
**Primary Purpose:** Applied AI Engineer Portfolio — Demonstrable, Measurable, Defensible

---

## Why v3.0 Exists

v1.0 and v2.0 were excellent design exercises but both exceeded an 8-week part-time scope. The senior engineering review identified that the CCM auto-update loop, gamification/quest system, and guided template journals were product features that added scope without adding AI depth to the portfolio.

v3.0 builds exactly four AI systems — and builds them properly.

### What Was Cut and Why

| Removed Feature | Was In | Why Cut |
|---|---|---|
| CCM auto-update agent loop | v2.0 | Hardest prompt engineering challenge in the project — high risk of consuming Week 6–7 without measurable output. Re-introduced post-launch. |
| Gamification: XP, levels, streaks | v1.0, v2.0 | Product feature, not AI depth. Does not contribute to any resume metric. |
| Quest system | v1.0, v2.0 | Same reason — interesting product, zero AI portfolio value in v1.0. |
| Guided template journal modes | v2.0 | Character-prompted quick capture is sufficient. Templates add UX scope without AI depth. |
| Full stats dashboard | v2.0 | Nice product polish, zero AI credibility. Cut. |
| Langfuse self-hosted Docker | v2.0 | Optional in v3.0 — app works fully without it. Reduces setup complexity. |

---

## 1. What We Are Building

Lumina is a lightweight AI desktop companion that sits as an overlay on the user's screen. It passively reads which application is currently focused, uses that context to understand what the user is doing, and decides — through an agentic reasoning loop — when to ask a thoughtful question, offer a check-in, or stay quiet.

Every interaction the user has with Lumina — journal responses, chat messages, mood signals — is embedded into a local vector memory using sqlite-vec. When the companion responds, it retrieves the most relevant memories from across the user's history and grounds its response in them. Over time the companion builds a richer picture of who the user is, expressed as a Companion Core Memory document that evolves with each conversation.

The entire system runs locally. No data leaves the device. No server process. One SQLite file. The companion is private by design.

> **The One-Paragraph Pitch**
> Lumina is the AI companion that actually knows you. It watches what you are working on, waits until you are not in deep focus, and then asks the right question at the right moment — grounded in everything you have told it before. It is not a chatbot. It is not a habit tracker. It is the persistent, present, private companion that remembers your journey and shows up when it matters.

---

## 2. The Four Core AI Systems

Everything in this PRD exists to build and validate these four systems. They are the resume bullet, the interview conversation, and the portfolio differentiator.

| System | What It Does | Key Tech | Portfolio Signal |
|---|---|---|---|
| 1. Activity Monitor | Reads active app name, classifies into 8 activity states in real time | @paymoapp/active-window, Node.js native addon | Context-aware AI, not just a reactive chatbot |
| 2. Interruption Intelligence | 5-gate sequential check before any companion initiation — absolute rules for focus states | LangGraph StateGraph gate nodes, node-cron | Production AI thinking: restraint matters more than responsiveness |
| 3. RAG Memory Pipeline | Embeds all journal entries and conversations into sqlite-vec, hybrid retrieval + cross-encoder reranking | sqlite-vec, nomic-embed-text, Xenova ONNX reranker | Full RAG stack without cloud dependency |
| 4. Companion Core Memory | Living structured document describing who the user is — updated via user-approved proposals, read by every LLM call | SQLite JSON columns, CCM summary injection, LangChain.js | Stateful AI persona, not a stateless chatbot |

---

## 3. Scope — v1.0 vs Future

| # | Feature | Version | AI Depth? | Notes |
|---|---|---|---|---|
| F-01 | Companion character with 6 animation states | v1.0 | No | CSS sprite animations — placeholder is fine |
| F-02 | Transparent always-on-top overlay window | v1.0 | No | Electron window config |
| F-03 | Auto-hide during DEEP_WORK, GAMING, VIDEO_CALL | v1.0 | Yes | Core behaviour driven by interruption system |
| F-04 | Activity monitoring and state classification | v1.0 | Yes | @paymoapp/active-window + classification logic |
| F-05 | Activity state classification engine | v1.0 | Yes | 8-state deterministic lookup table |
| F-06 | Character-prompted quick capture journal | v1.0 | Yes | Single question, short response, no form |
| F-07 | Free-form journal entry (optional) | v1.0 | Yes | Available but not primary flow |
| F-08 | Emoji vibe check mood capture | v1.0 | Yes | 4-emoji one-tap, max once per 4h |
| F-09 | Memory ingestion pipeline | v1.0 | Yes | sqlite-vec, nomic-embed-text, chunking, importance scoring |
| F-10 | Hybrid retrieval + reranking | v1.0 | Yes | sqlite-vec KNN + FTS5 + Xenova cross-encoder |
| F-11 | Memory budget and retention | v1.0 | Yes | Hard caps, auto-pruning, conversation summarisation |
| F-12 | Companion Core Memory structure and injection | v1.0 | Yes | Structured document, compressed injection, viewable in settings |
| F-13 | CCM prompt injection per message | v1.0 | Yes | Layered prompt assembly with token budget |
| F-14 | Memory-grounded chat | v1.0 | Yes | Retrieval → prompt construction → streamed response |
| F-15 | Companion personality constraints | v1.0 | Yes | Hard rules baked into Core Identity layer |
| F-16 | Five-gate interruption system | v1.0 | Yes | All 5 gates must pass, absolute rules |
| F-17 | Transition moment detection | v1.0 | Yes | DEEP_WORK→BROWSING triggers priority agent run |
| F-18 | LangGraph agent loop | v1.0 | Yes | node-cron, 6 nodes, Observe/Analyse/Decide/Act/Log |
| F-19 | Local observability to SQLite | v1.0 | Yes | All LLM calls, retrieval, agent events logged locally |
| F-20 | Langfuse observability (optional) | v1.0 | Yes | Off by default, enable in settings |
| F-21 | Golden dataset + CI evaluation pipeline | v1.0 | Yes | 30 scenarios, RAGAS + DeepEval, GitHub Actions |
| F-22 | Onboarding flow | v1.0 | No | First-run intro, permission request, first CCM entry |
| F-23 | Settings panel (minimal) | v1.0 | No | Model, activity monitor, Langfuse, CCM view |
| — | Gamification — XP, levels, streaks | v2.0 | No | Cut from v1.0 |
| — | Quest system | v2.0 | No | Cut from v1.0 |
| — | CCM auto-update agent loop | v2.0 | Yes | Cut from v1.0 — high risk |
| — | Guided template journal modes | v2.0 | No | Cut from v1.0 |
| — | Full stats dashboard | v2.0 | No | Cut from v1.0 |
| — | Voice input / output | v3.0 | Possibly | Not in scope |
| — | Cloud sync | v3.0 | No | Not in scope |
| — | Calendar / health integrations | v3.0 | No | Not in scope |

---

## 4. Feature Requirements

### 4.1 Companion Overlay Window

#### F-01 — Companion Character `MUST HAVE`
*The animated creature that lives on the user's screen. Placeholder-quality animation is acceptable in v1.0 — AI depth takes priority over visual polish.*

- Electron BrowserWindow: transparent background, always-on-top, non-interactive by default (click-through when not hovered)
- Default position: bottom-right corner of primary screen. User can drag to reposition; position saved in electron-store
- Companion rendered at 96x96px at rest, 120x120px when speaking or active
- Six CSS animation states: Idle (gentle float loop), Happy (bounce), Thinking (pulse), Concerned (slow sway), Celebrating (energetic bounce), Sleeping (eyes closed, breathing)
- Original creature design — round, soft, expressive. Generate with Midjourney or Ideogram. No derivative of existing IP.
- State transitions driven by: agent decision type, current mood trend, time of day

#### F-02 — Overlay Auto-Hide Behaviour `MUST HAVE`
*The companion earns its place on the screen by disappearing when it would be intrusive.*

- During DEEP_WORK and STUDY: companion slides to 25% off-screen edge — only a small curve visible. Fully hidden option in settings.
- During GAMING: companion window opacity set to 0 — invisible
- During VIDEO_CALL: companion excluded from screen capture (Electron setContentProtection) AND opacity 0
- During IDLE and BROWSING: fully visible at rest
- Transition animation: 400ms ease-in-out slide
- Panel auto-collapses when user switches to DEEP_WORK or GAMING app

#### F-03 — Companion Panel `MUST HAVE`
*The expanded interaction area. Minimal by design — not a full app window.*

- Triggered by: clicking companion character, or Cmd/Ctrl+Shift+L keyboard shortcut
- Panel dimensions: 320px wide, max 440px tall — slides up from companion position
- Layout top to bottom: companion character (64px) + status text, conversation thread (last 6 messages, scrollable), single-line text input + send button
- Two icon buttons at bottom: Journal (opens quick capture), Settings
- Auto-collapses after 60 seconds of no interaction, or immediately on switch to DEEP_WORK or GAMING
- No navigation menu, no tabs — one view only

---

### 4.2 Activity Monitoring System

#### F-04 — Active Window Detection `MUST HAVE`
*The foundational context signal. Everything the companion knows about what the user is doing comes from this system.*

- Library: @paymoapp/active-window — native Node addon, macOS (Accessibility API) and Windows (Win32 API)
- Runs in Electron main process only — never in renderer
- Polling interval: every 10 seconds
- Returns: application name, window title, process path
- macOS: Accessibility permission required on first launch with one-sentence explanation: *"Lumina reads which app is open so it knows when not to interrupt you. It never reads the content of your windows."*
- If permission denied: app runs in degraded mode — all time treated as BROWSING state, clearly indicated in settings
- Window titles stored as SHA-256 hash only — never as plain text
- Polling stops when system is sleeping

#### F-05 — Activity State Classification `MUST HAVE`
*Transforms raw app name and window title into one of 8 actionable activity states.*

- Classification runs in main process: deterministic lookup table + pattern matching — no LLM call
- Classification table maintained as a JSON config file — extensible without code changes
- Unknown apps default to BROWSING — never DEEP_WORK (fail safe toward more interruption, not less)
- Activity session stored on state change: `{app_name, category, started_at, ended_at, duration_seconds}`

**The 8 states:**

| State | Detected Patterns |
|---|---|
| DEEP_WORK | VSCode, IntelliJ, Xcode, Vim, terminal emulators, Word/Docs with 20+ min active session, Figma, Sketch |
| STUDY | Notion, Obsidian, PDF readers, browser with arxiv/coursera/khanacademy/udemy/edx in window title |
| GAMING | Steam, Epic Games Launcher, game processes, fullscreen non-browser non-productivity app |
| VIDEO_CALL | Zoom, Microsoft Teams, Google Meet, FaceTime, Discord with 'call' or 'meeting' in window title |
| PASSIVE_CONTENT | Browser with youtube.com/netflix.com/twitch.tv/spotify.com in title; standalone media players |
| BROWSING | Chrome, Firefox, Safari, Edge — default browser catch-all |
| IDLE | No active window change for 5+ mins AND no keyboard/mouse input (Electron powerMonitor.getSystemIdleTime()) |
| LUMINA | Lumina itself is the focused app |

---

### 4.3 Journal System

#### F-06 — Character-Prompted Quick Capture `MUST HAVE`
*The companion asks one specific, contextual question. The user answers in the speech bubble area. Response becomes a journal entry. No form, no labels, no friction.*

- Companion asks via speech bubble — user sees the companion speaking, not a form
- User types response in the speech bubble reply area (same as chat input)
- Minimum 10 characters to submit — no maximum
- On submission: stored with `mode='prompted'`, question stored alongside answer for retrieval context
- If dismissed: same question not re-asked for 4 hours minimum
- No question repeated within 48 hours
- Companion reacts with Happy animation after user submits

**Activity-aware question examples:**
- "You just switched away from your code — how did that session go?"
- "Looks like you've been at your desk for a while — what's on your mind?"
- "You were watching something — anything interesting?"
- "How is the studying going?"

**Temporal question examples:**
- "How has your day been so far?"
- "Anything weighing on you lately?"
- "What went well today?"
- "Is there something you're looking forward to?"

#### F-07 — Free-Form Journal Entry `MUST HAVE`
*For users who want to write longer. Available from the Journal button in the panel. Not surfaced as the primary interaction.*

- Simple textarea — no required fields, no word count, no mood slider
- Optional guiding question shown as placeholder text inside textarea — rotates based on recent memory
- Entry stored with `mode='freeform'`

#### F-08 — Emoji Vibe Check `MUST HAVE`
*One-tap mood signal. Four emoji, one second, done.*

- Triggered in IDLE or BROWSING states only — never mid-task
- Maximum once every 4 hours — rate limited strictly
- Companion speech bubble shows: `😤  😐  😊  🔥 — how are you feeling right now?`
- User taps one emoji — stored immediately, companion gives brief acknowledgement
- If dismissed: not re-asked for 6 hours
- Stored as: `{source: 'emoji_vibe', value: 'frustrated|okay|good|amazing', normalised_score: 0.25|0.5|0.75|1.0}`
- LLM also performs passive mood inference from free-form journal text — stored as `source='text_inference'`
- Activity-pattern mood inference stored as `source='activity_inference'` with low confidence weight
- Combined mood trend: weighted average of all three sources, used by agent Analyse node

---

### 4.4 Memory and RAG System

#### F-09 — Memory Ingestion Pipeline `MUST HAVE`
*Every journal entry and conversation message is chunked, embedded, and stored in sqlite-vec.*

- Runs asynchronously in Electron main process — entry stored immediately, embedding in background worker thread
- Chunking: split by paragraph, max 300 tokens per chunk, 30-token overlap
- Short entries under 100 tokens: stored as single chunk without splitting
- Embedding: nomic-embed-text via Ollama REST API — 768-dimension float32 vectors
- Stored in `memory_chunks` table + `memory_vec` sqlite-vec virtual table
- Importance score at ingestion: base 0.5, +0.2 emotional content (LLM-classified), +0.2 recency (last 7 days), +0.1 user-initiated
- Retrieval count tracked per chunk — frequently retrieved chunks get importance boosted
- Embedding failure: entry saved with `embedding_status='pending'`, retried on next launch

#### F-10 — Hybrid Retrieval and Reranking `MUST HAVE`
*Two-stage retrieval: broad recall via vector similarity and keyword search, then precision via cross-encoder reranking.*

- Stage 1a — Vector search: sqlite-vec KNN query against query embedding, top-20 by cosine similarity
- Stage 1b — Keyword search: SQLite FTS5 full-text index on chunk content, top-20 by BM25 score
- Merge and deduplicate by chunk_id — up to 30 unique candidates
- Stage 2 — Reranking: @xenova/transformers cross-encoder (ms-marco-MiniLM-L-6-v2 ONNX) scores each candidate
- Return top-5 chunks sorted by cross-encoder score with: chunk text, source_type, source_id, similarity score, reranker score, created_at
- Target: under 250ms end-to-end
- Retrieved chunk IDs stored with each assistant message for groundedness tracking

#### F-11 — Memory Budget and Retention `MUST HAVE`
*Memory must not become a storage burden. Hard caps and automatic pruning keep the database under 100MB indefinitely.*

- Maximum 2000 memory chunks — hard cap
- When chunk count reaches 1800: pruning triggered, lowest importance_score chunks deleted to 1500
- Conversation history: raw message text retained 90 days. After 90 days: LLM generates semantic summary, raw messages deleted
- Activity sessions: purged after 30 days automatically
- sqlite-vec index rebuilt weekly via node-cron to reclaim space
- Storage budget display in settings: current database size and time to next pruning

---

### 4.5 Companion Core Memory (CCM)

#### F-12 — CCM Structure `MUST HAVE`
*A living structured document defining who Lumina is in relation to this specific user. NOT auto-updated in v1.0 — built through user-approved proposals.*

- Stored as a single row in `companion_core_memory` table as structured JSON with four sections
- **Section 1 — User Facts:** name, stated goals, occupation/context, important people mentioned, significant events
- **Section 2 — User Patterns:** typical active hours, productivity style, recurring topics, things they celebrate
- **Section 3 — Relationship Notes:** tone calibrations that work, recurring themes, questions the user has found useful
- **Section 4 — Companion Tone:** formal/casual preference (1–5 scale), directness, humour level, check-in frequency preference
- CCM starts empty — populated via CCM proposals from conversations
- Companion extracts facts and proposes additions: *"You mentioned you're a software engineer — should I remember that?"*
- User explicitly accepts or rejects — nothing added without consent
- Fully viewable and editable in settings
- Last 5 CCM states retained for rollback

#### F-13 — CCM Prompt Injection `MUST HAVE`
*The CCM is used efficiently — a compressed summary at conversation start, with selective retrieval when relevant.*

- At conversation start: 250–300 token CCM summary included in system context
- Summary includes: user name, top 3 stated goals, current tone preference, relationship stage (new/familiar/close)
- When a message touches a specific CCM domain, the relevant section is retrieved and added to context
- CCM summary regenerated only when CCM changes — cached otherwise

**Per-message token budget:**

| Layer | Content | Token Budget |
|---|---|---|
| Core Identity | Fixed: who Lumina is, what it never does | ~150 tokens |
| CCM Summary | User name, top 3 goals, tone, relationship stage | ~300 tokens |
| Retrieved Memories | Top 3–5 chunks from sqlite-vec retrieval | ~400 tokens |
| Activity Context | Current state + last transition | ~50 tokens |
| Conversation History | Last 4 turns | ~300 tokens |
| **Total base** | | **~1200 tokens** |

---

### 4.6 Conversational AI

#### F-14 — Memory-Grounded Chat `MUST HAVE`
*Every companion response is grounded in retrieved memories. The companion does not make things up about the user.*

- User message triggers: embed query → hybrid retrieval (F-10) → prompt construction → Ollama LLM → streamed response
- Streaming: response tokens streamed to renderer via IPC — companion shows Thinking animation during generation
- Groundedness check (async, after response delivered): LLM verifies each factual claim has a cited chunk. Score stored in messages table.
- Target groundedness: ≥88% of messages score above 0.85
- If no relevant memories retrieved: companion responds from CCM and general knowledge only — never fabricates personal details

#### F-15 — Companion Personality Constraints `MUST HAVE`
*Hard rules baked into the Core Identity prompt layer. Not configurable.*

- The companion **never** pretends to be human if directly asked
- The companion **never** gives unsolicited advice — it asks questions and reflects
- The companion **can** offer support and gentle guidance when the user is clearly struggling — framed as a question, not a recommendation
- The companion does not continue a conversation if user switches to DEEP_WORK — it says "Go get it — we can talk later" and goes quiet
- The companion does not repeat itself — if a topic is dismissed, it does not return to it in the same session
- Tone is warm, curious, occasionally gently playful — never sycophantic, never preachy

---

### 4.7 Interruption Intelligence System

#### F-16 — Five-Gate Interruption System `MUST HAVE`
*ALL five gates must pass before any proactive companion initiation. Any failure = HOLD. No override.*

**Gate 1 — Activity State**
PASS if: IDLE, BROWSING, or PASSIVE_CONTENT with ≥5 min content gap
HOLD for: everything else
*This gate is absolute and has no override.*

**Gate 2 — Time of Day**
PASS if: 8:00am–10:00pm in user's local timezone
HOLD: outside these hours

**Gate 3 — Recency**
PASS if: last companion initiation was ≥2 hours ago
HOLD: if too recent

**Gate 4 — Priority Dedup**
If multiple messages queued: only highest-priority passes
Priority order: CELEBRATE > CHECKIN > NUDGE
Lower-priority messages are discarded

**Gate 5 — Engagement History**
If last 3 consecutive initiations dismissed → minimum gap doubles to 4 hours
If last 5 consecutive dismissed → all proactive messages paused 72 hours, settings prompt shown

- Gate evaluation order is fixed — evaluate 1 through 5 in sequence, stop at first failure
- All gate results logged to `agent_events` table
- 90-second delay applied after transition detected before initiating

#### F-17 — Transition Moment Detection `MUST HAVE`
*The highest-value interruption windows occur when users finish a task.*

- Monitors: `{DEEP_WORK or STUDY}` → `{BROWSING or IDLE}`
- When detected: agent triggered after 90-second delay
- Transition agent run gets priority boost: Gate 3 threshold drops from 2 hours to 1 hour
- Context passed to agent: *"User just transitioned from DEEP_WORK after 2h 15m"*
- If transition detected during night hours (Gate 2 fails): message queued for next morning window

---

### 4.8 LangGraph Agent Loop

#### F-18 — Agent Scheduler and State Machine `MUST HAVE`
*The background agent that drives proactive behaviour. Most runs result in SILENCE — this is by design.*

- Scheduler: node-cron in Electron main process — every 30 minutes + triggered on activity state transitions
- Framework: LangChain.js StateGraph — 6 nodes in sequence

**Agent state object:**
```
{
  activity_state, last_journal_at, last_conversation_at,
  mood_trend_7d, mood_trend_direction, time_of_day,
  gate_results, retrieved_memories, analysis,
  action_type, message
}
```

**Node 1 — Gate Check**
Evaluates all 5 gates in sequence. Any gate fails → set `action_type=SILENCE`, skip to Log node. No LLM called.

**Node 2 — Observe**
Reads: last_journal_timestamp, last_conversation_timestamp, mood_logs (7d average + trend direction), current activity state, time since last initiation.

**Node 3 — Analyse**
Embeds observation summary → hybrid retrieval (top-3 memories) → LLM generates analysis of user's current state and what they might need.

**Node 4 — Decide**
LLM selects action from `{CELEBRATE, CHECKIN, NUDGE, SILENCE}`. SILENCE is the default — requires a clear positive signal to choose otherwise.

**Node 5 — Act**
If not SILENCE: LLM generates message grounded in retrieved memories and calibrated to CCM tone. Message pushed to renderer via IPC.

**Node 6 — Log**
Writes `agent_event` to SQLite. Emits Langfuse trace if enabled.

> No LLM calls in Gate Check or Observe nodes. Most runs use zero LLM calls.

---

### 4.9 Observability

#### F-19 — Local Observability `MUST HAVE`
*Core metrics logged to SQLite regardless of Langfuse. This is what generates the resume numbers.*

- Every LLM call logged: prompt_tokens, completion_tokens, model, duration_ms, context
- Every retrieval logged: query_hash, top_chunk_ids, similarity_scores, reranker_scores, duration_ms
- Every agent run logged: all 5 gate results, action_type, message_generated, user_response
- Every message: groundedness_score stored in messages table
- In-app metrics view in settings: median response latency (last 50), average groundedness (last 50), agent initiation rate, dismissal rate

#### F-20 — Langfuse Observability (Optional) `SHOULD HAVE`
*Full distributed tracing when enabled. Off by default.*

- Toggle in settings: Observability → Langfuse On/Off
- When enabled: all LLM calls, retrieval calls, and agent node transitions emit Langfuse spans
- Self-hosted via Docker Compose (dev profile — not shipped with app)
- Langfuse cloud free tier also supported — user provides API key in settings
- Agent trajectory fully visible: each node as a child span under the parent agent run trace

---

### 4.10 Evaluation Harness

#### F-21 — Golden Dataset and CI Pipeline `MUST HAVE`
*The evaluation harness is what separates this from a demo. It is the evidence the system works at a measurable level.*

- Golden dataset: 30 synthetic scenarios in `/tests/golden/` as JSON
- Each scenario: `journal_entries`, `conversation_history`, `query`, `expected_retrieved_chunk_ids`, `expected_response_quality_label`, `expected_gate_result`, `expected_action_type`
- Scenario breakdown: 10 retrieval quality tests, 10 agent decision tests, 10 interruption gate tests
- Python eval script: RAGAS faithfulness + context_relevance against retrieval results
- DeepEval tests: schema validation, hallucination checks
- 10 agent scenario unit tests: simulate user state → assert correct gate outcome + action type
- GitHub Actions CI: fails if faithfulness < 0.83, groundedness < 0.86, any DeepEval test fails, any agent test fails
- Evaluation results stored as JSON artefact in CI — versioned per commit

---

### 4.11 Onboarding and Settings

#### F-22 — Onboarding Flow `MUST HAVE`
*First-run experience that establishes trust, requests permissions clearly, and gets the user to their first interaction quickly.*

1. Companion appears and introduces itself via speech bubble sequence (3 bubbles max)
2. Permission request for activity monitoring — single clear sentence, Yes/No buttons. If No: continues in degraded mode.
3. Companion asks user's name — stored in CCM User Facts
4. Companion explains it will ask questions over time and the user can open it with the keyboard shortcut
5. Companion prompts first question: *"What is one thing you are working towards right now?"* — response becomes first journal entry

Onboarding complete. No tutorial, no tour, no more steps.

#### F-23 — Settings Panel `MUST HAVE`
*Minimal. Only what the user genuinely needs to configure.*

- **LLM Model:** dropdown of available Ollama models (fetched from Ollama `/api/tags`)
- **Activity Monitoring:** On/Off toggle, shows current activity state when on
- **Check-in Frequency:** Relaxed (max 1/day) / Normal (max 2/day) / Active (max 3/day)
- **Observability:** Off / Langfuse Local / Langfuse Cloud (API key input)
- **Companion Core Memory:** view-only CCM JSON display. Edit button opens CCM editor. Pending proposals shown with Accept/Reject.
- **Database:** current size, Export data (JSON), Clear all data (with confirmation)

---

## 5. Technical Architecture

### 5.1 Architecture in One Paragraph

Lumina is a single Electron application. There is no separate backend server. All business logic runs in the Electron main process and communicates with the React renderer via IPC. SQLite with the sqlite-vec extension stores all data. Ollama runs as a separate local process and is called from the main process on `127.0.0.1:11434`. No ports are exposed. No data leaves the device. The app is a single packaged binary plus a SQLite file in the OS app data directory.

### 5.2 Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop Shell | Electron 30+ + electron-vite | electron-vite for fast HMR dev |
| Frontend | React 18 + TypeScript + TailwindCSS | No external component library |
| Main Process Logic | TypeScript (Node.js 20+) | All AI orchestration, IPC handlers, scheduling |
| Agent Framework | LangChain.js StateGraph | Node.js port of LangGraph — no Python runtime in app |
| Database | SQLite via better-sqlite3 | Synchronous API, ideal for Electron IPC |
| Vector Search | sqlite-vec extension | Embedded vector search — no separate process |
| Embedding | nomic-embed-text via Ollama | 768-dim, runs locally |
| LLM Inference | Llama 3.1 8B Q4_K_M via Ollama | Phi-3 Mini 3.8B as fallback for Intel Macs |
| Cross-Encoder Reranker | @xenova/transformers (ONNX) | ms-marco-MiniLM-L-6-v2 — runs in Node.js |
| Activity Monitor | @paymoapp/active-window | Native Node addon, macOS + Windows |
| Scheduling | node-cron | Lightweight in-process scheduler |
| Configuration | electron-store | JSON config in OS userData directory |
| Observability (opt) | Langfuse SDK | langfuse npm package — disabled by default |
| Eval (dev only) | Python: ragas, deepeval | Not shipped with app |

### 5.3 IPC Channel Contracts

All renderer-to-main communication uses named IPC channels. `contextBridge` exposes only whitelisted methods. `nodeIntegration` is disabled in renderer.

| IPC Channel | Direction | Payload | Response |
|---|---|---|---|
| `journal:create` | Renderer → Main | `{ content, mode, guiding_question? }` | `{ id, created_at }` |
| `chat:message` | Renderer → Main | `{ content, conversation_id }` | Stream of `{ delta }` then `{ done, groundedness_score }` |
| `mood:log` | Renderer → Main | `{ value: emoji_key }` | `{ id }` |
| `memory:search` | Renderer → Main | `{ query }` | `{ chunks: [...] }` |
| `agent:status` | Main → Renderer | `{ action_type, message? }` | — fire and forget |
| `activity:state` | Main → Renderer | `{ state, app_name }` | — fire and forget |
| `ccm:get` | Renderer → Main | `{}` | `{ ccm: JSON }` |
| `ccm:update` | Renderer → Main | `{ section, data }` | `{ ok }` |
| `ccm:propose` | Main → Renderer | `{ fact, source }` | — user sees in panel |
| `settings:get` | Renderer → Main | `{}` | `{ settings: JSON }` |
| `settings:set` | Renderer → Main | `{ key, value }` | `{ ok }` |
| `metrics:get` | Renderer → Main | `{}` | `{ latency_p50, groundedness_avg, initiation_rate, dismissal_rate }` |

### 5.4 Data Model

#### SQLite Tables

```
user_profile
  id, name, created_at, onboarding_complete, last_active_at

journal_entries
  id, mode, content, guiding_question, mood_emoji, mood_inferred,
  activity_state_at_entry, embedding_status, created_at

memory_chunks
  id, source_type (journal/conversation/summary), source_id, chunk_index,
  content, importance_score, retrieval_count, last_retrieved_at, created_at

memory_vec  [sqlite-vec virtual table]
  rowid (= memory_chunk.id), embedding float[768]

conversations
  id, created_at, summarised_at, summary_chunk_id

messages
  id, conversation_id, role, content, retrieved_chunk_ids (JSON array),
  groundedness_score, created_at

mood_logs
  id, source (emoji_vibe | text_inference | activity_inference),
  raw_value, normalised_score (0.0–1.0), created_at

activity_sessions
  id, app_name, category, window_title_hash, duration_seconds,
  started_at, ended_at

companion_core_memory
  id (always 1), user_facts (JSON), user_patterns (JSON),
  relationship_notes (JSON), tone_calibration (JSON),
  last_updated_at, version, previous_versions (JSON array of last 5)

ccm_proposals
  id, section, proposed_key, proposed_value, source_message_id,
  status (pending|accepted|rejected), created_at

agent_events
  id, run_id, trigger (scheduled|transition), activity_state,
  gate_1 through gate_5 (pass|hold), action_type, message_generated,
  user_response (engaged|dismissed|no_response), langfuse_trace_id, created_at

llm_calls
  id, model, prompt_tokens, completion_tokens, duration_ms,
  context (chat|agent|groundedness|ccm_extraction), created_at

retrieval_logs
  id, query_hash, chunk_ids (JSON), similarity_scores (JSON),
  reranker_scores (JSON), duration_ms, created_at
```

#### Key Indexes

- `memory_vec`: sqlite-vec index on embedding column (KNN search)
- `memory_chunks`: FTS5 full-text search index on content (keyword search)
- `journal_entries`: index on created_at (recency queries)
- `mood_logs`: index on created_at (trend queries)
- `activity_sessions`: index on started_at (recent activity queries)
- `messages`: index on conversation_id + created_at (history queries)

### 5.5 Repository Structure

```
src/
  main/
    agent/          — LangGraph StateGraph nodes and scheduler
    memory/         — Ingestion pipeline, chunking, embedding, retrieval, reranking
    activity/       — Active window polling, state classification, session management
    ccm/            — CCM read, write, proposal management, summary generation
    db/             — SQLite schema, migrations, query helpers
    ipc/            — IPC handler registration
  renderer/         — React app: companion UI, panel, settings, chat
tests/
  golden/           — 30-scenario golden dataset JSON files
  eval/             — Python evaluation scripts (dev only)
.github/
  workflows/
    eval.yml        — CI evaluation pipeline
docker-compose.dev.yml  — Langfuse dev profile (optional)
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Hard Limit |
|---|---|---|
| Chat response latency — median (M-series Mac) | < 3.0 seconds | < 5.0 seconds |
| Chat response latency — median (Intel Mac) | < 5.0 seconds | < 8.0 seconds |
| Memory retrieval pipeline | < 250ms end-to-end | < 500ms |
| Agent loop (gate check + analyse + decide) | < 8.0 seconds | < 15 seconds |
| App launch to companion visible | < 4.0 seconds | < 8 seconds |
| App RAM at rest (excluding Ollama) | < 120MB | < 200MB |
| Database size at 12 months daily use | < 80MB | < 120MB |

### 6.2 Privacy and Security

- All LLM inference via Ollama on `127.0.0.1:11434` — loopback only, no external network
- All data in SQLite file in OS app data directory — no cloud sync, no telemetry
- No keylogging, no clipboard monitoring, no screenshot capture — ever
- Window titles stored only as SHA-256 hash — never as plain text
- Activity monitoring requires explicit user permission on macOS — and can be disabled
- IPC channels fully enumerated in `contextBridge` — no arbitrary channel access
- `nodeIntegration: false` in renderer
- User can export all data as JSON and delete everything from settings

### 6.3 Reliability

- Ollama unavailable: graceful message shown ('Lumina is waking up...'), retry after 30 seconds
- Embedding pipeline failure: entry saved with `embedding_status='pending'`, retried on next launch
- Agent loop crash: isolated — does not affect chat or journal, error logged to SQLite
- sqlite-vec extension load failure: fallback to keyword-only search with user notification
- All async operations have explicit timeout handling — no silent hangs

### 6.4 Platform Requirements

- **macOS:** 13.0+ (Ventura). Apple Silicon (M1+) recommended. Intel supported with Phi-3 Mini.
- **Windows:** 10 and 11. x64 only.
- **RAM:** 8GB minimum. 16GB recommended.
- **Storage:** 10GB free for Ollama models + database + app.
- Ollama must be installed separately — README provides direct link and setup steps.

---

## 7. Success Metrics

### 7.1 Technical Metrics — The Resume Numbers

| Metric | Target | How Measured |
|---|---|---|
| RAGAS Faithfulness | ≥ 0.85 | Offline eval against 30-scenario golden dataset |
| RAGAS Context Relevance | ≥ 0.80 | Same golden dataset eval |
| Response Groundedness | ≥ 88% | groundedness_score in messages table, last 50 messages |
| Agent Initiation Dismissal Rate | < 12% | agent_events: dismissed / (engaged + dismissed) |
| Memory Retrieval Latency | < 250ms median | retrieval_logs: duration_ms p50 |
| Chat Response Latency | < 3.5s median (M-series) | llm_calls: duration_ms p50 |
| App RAM at Rest | < 120MB | Manual process monitor |
| CI Pipeline | Green on main branch | GitHub Actions status badge |

### 7.2 Product Metrics

- 5+ people use the companion for 7+ consecutive days
- Companion initiation engagement rate > 45%
- At least 3 unprompted comments from testers that the companion felt like it remembered them
- Zero critical crashes in a 14-day test period

### 7.3 Target Resume Bullet

> Built Lumina, a privacy-first AI desktop companion with passive activity-state monitoring (8-category classification via @paymoapp/active-window), a 5-gate interruption intelligence system (absolute rules for focus states), and a full RAG memory pipeline (sqlite-vec hybrid retrieval with Xenova ONNX cross-encoder reranking) — grounded in an evolving Companion Core Memory injected per-conversation, with a LangGraph agentic proactive loop, local Llama 3.1 8B inference via Ollama, and Langfuse observability; achieving 85%+ RAGAS faithfulness, 88%+ response groundedness, sub-250ms retrieval latency, and <12% proactive initiation dismissal rate.

---

## 8. Open Questions — Resolve Before Week 1

> **Action Required:** These questions must be answered before coding begins. Update this document with your decisions and mark each as RESOLVED. Do not start Week 1 Day 1 until all CRITICAL questions are resolved.

| # | Question | Priority | Decision |
|---|---|---|---|
| OQ-01 | Benchmark Llama 3.1 8B Q4_K_M vs Phi-3 Mini 3.8B on your machine before starting. | **CRITICAL** | [ Decide after benchmark ] |
| OQ-02 | LangChain.js StateGraph or sequential async functions with explicit state object? Evaluate LangChain.js maturity in Week 1. | **CRITICAL** | [ Decide end of Week 1 ] |
| OQ-03 | Use window title for richer classification (detect 'arxiv' in browser title) or app name only? | MEDIUM | Default: use window title for classification only — never store raw |
| OQ-04 | How to handle Ollama not installed on first launch? Define onboarding error state. | MEDIUM | [ Define onboarding error state ] |
| OQ-05 | Test sqlite-vec packaging in Electron in Week 1 Day 2 before building anything on top of it. | **CRITICAL** | Fallback: cosine similarity in JS on top-50 FTS results |
| OQ-06 | Companion character: commission, Midjourney/Ideogram, or CSS placeholder for first 6 weeks? | LOW | Placeholder until Week 7 |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| sqlite-vec native addon fails to package in Electron | Medium | High | Test Week 1 Day 2 before anything is built on top of it. JS cosine fallback defined in OQ-05. |
| LangChain.js StateGraph too immature — undocumented edge cases | Medium | Medium | Evaluate maturity in Week 4. Fallback: sequential async state machine functions. |
| Activity monitor permission refused by majority of macOS testers | Medium | High | Degraded mode must work well. Onboarding explanation must be clear. |
| Ollama latency too high on Intel Macs | High | Medium | Phi-3 Mini benchmark in Week 1. Set hardware requirements clearly in README. |
| Groundedness target not met — companion makes things up | Low | High | Strict retrieved-context-only constraint in system prompt. Groundedness check enforced in CI. |
| Scope creep back to v2.0 features | High | High | PRD is locked. No new features until v1.0 metrics are documented. |

---

## 10. Appendix

### 10.1 Glossary

**sqlite-vec** — SQLite extension providing vector similarity search (KNN). Stores float32 embedding vectors alongside relational data in a single database file.

**Companion Core Memory (CCM)** — The living structured document that represents what Lumina knows about the user. Updated via user-approved proposals in v1.0. Auto-update loop deferred to v2.0.

**Activity State** — One of eight categories (DEEP_WORK, STUDY, GAMING, VIDEO_CALL, PASSIVE_CONTENT, BROWSING, IDLE, LUMINA) derived from the active application name and window title.

**Interruption Gate** — One of five sequential checks that must all pass before the companion sends a proactive message. Any failure results in HOLD.

**Groundedness** — The degree to which each factual claim in a companion response is supported by a retrieved memory chunk. Measured as a score 0–1 by a secondary LLM verification call.

**Transition Moment** — The window immediately after a user switches from DEEP_WORK or STUDY to a lower-focus activity. The highest-value window for companion contact.

**CCM Proposal** — A fact extracted from user interaction that the companion proposes adding to the CCM. Requires explicit user Accept/Reject before being stored.

**RAGAS Faithfulness** — A metric measuring whether each statement in a generated answer is supported by the retrieved context. Score range 0–1. Target ≥ 0.85.

**Cross-Encoder Reranker** — A model that jointly encodes a query and a document to produce a relevance score. More accurate than embedding similarity alone. Used to rerank the top-30 retrieval candidates to top-5.

**@xenova/transformers** — JavaScript port of Hugging Face transformers running ONNX models in Node.js. Used to run the cross-encoder without a Python runtime.

### 10.2 Ollama Setup Dependency

Lumina requires Ollama to be installed on the user's machine. The app detects Ollama on startup and guides the user if not present.

- **Detection:** `GET http://127.0.0.1:11434/api/tags` — connection refused means Ollama is not running
- **Required models:** `nomic-embed-text` (embedding) and either `llama3.1:8b` or `phi3:mini` (generation)
- **First run:** if models not pulled, companion shows setup screen with direct `ollama pull` commands
- **README:** includes complete Ollama installation section for macOS and Windows

---

*Lumina PRD v3.0 — Locked. Start building.*
