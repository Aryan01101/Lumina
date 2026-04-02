# Lumina — Privacy-First AI Desktop Companion

<div align="center">

**The AI companion that actually knows you**

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

*Your private, local AI companion that learns from your work patterns, remembers your conversations, and asks the right question at the right moment—without sending data to the cloud.*

</div>

---

## 🎯 The Problem

Generic AI assistants forget your context the moment you close the tab. Cloud-based solutions force you to trust strangers with your thoughts. Most chatbots interrupt you in the middle of deep work.

**Lumina solves this** with three principles:

1. **Privacy First** — 100% local processing. No cloud. No servers. One SQLite file.
2. **Memory That Persists** — Every conversation, journal entry, and mood is embedded into a vector database and retrieved when relevant.
3. **Interruption Intelligence** — A 5-gate agent system that respects your deep work and only speaks when it matters.

---

## ✨ Key Features

- 🧠 **Memory That Persists** — RAG pipeline with sqlite-vec vector embeddings and cross-encoder reranking
- 🎯 **Interruption Intelligence** — 5-gate system respects deep work, gaming, and video calls
- 🔒 **Privacy-First Architecture** — 100% local—no cloud, no servers, one SQLite file
- 💬 **Context-Aware Chat** — Every response grounded in your history with NLI-based groundedness scores
- 📊 **Activity Monitoring** — Understands what you're working on (8 activity states: DEEP_WORK, BROWSING, STUDY, etc.)
- 📝 **Journal & Mood Tracking** — Quick capture with character prompts, emoji-based mood check-ins
- 🤖 **Agent System** — LangGraph-powered decision making with gate-based reasoning
- 📈 **Observability** — Local metrics + optional Langfuse distributed tracing

---

## 🏗️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Desktop Framework** | Electron 30+ | Cross-platform overlay window with transparency |
| **Frontend** | React 18, TypeScript, Tailwind CSS | UI components with strict type safety |
| **Local LLM** | Ollama (llama3.1:8b) | All AI processing happens on-device |
| **Vector Database** | sqlite-vec | Semantic memory search and retrieval |
| **Database** | SQLite (better-sqlite3) | All data persistence in a single file |
| **Embeddings** | nomic-embed-text (Ollama) | Text → 768-dim vectors |
| **Reranking** | @xenova/transformers (ONNX) | Cross-encoder reranking for precision |
| **Agent Framework** | @langchain/langgraph | State machine workflow with gates |
| **Activity Monitor** | @paymoapp/active-window | Native window detection (macOS/Windows) |
| **Observability** | Langfuse (optional) | Distributed tracing and metrics |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Ollama** installed and running ([Download](https://ollama.com/))
- **Operating System:** macOS 13+ or Windows 10/11

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lumina.git
cd lumina

# Install dependencies
npm install

# Pull required Ollama models (one-time setup)
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# Start development mode
npm run dev
```

The companion will appear as a transparent overlay in the bottom-right corner of your screen.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode with hot reload |
| `npm run build` | Production build for distribution |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI |
| `npm run typecheck` | TypeScript type checking (strict mode) |
| `npm run benchmark:retrieval` | Benchmark memory retrieval latency |

---

## 🧠 Architecture & Data Flow

Lumina's intelligence flows through four interconnected systems:

```
┌─────────────────┐
│  User Activity  │ (What app is focused?)
└────────┬────────┘
         ↓
┌────────────────────────┐
│  Activity Monitor      │ → 8 States (DEEP_WORK, BROWSING, STUDY...)
└────────┬───────────────┘
         ↓
┌────────────────────────┐
│  Agent (5-Gate Check)  │ → Should I speak now?
│  1. Focus State        │    - Not during DEEP_WORK/GAMING/VIDEO_CALL
│  2. Time Since Last    │    - Respect cooldown periods
│  3. Transition Moment  │    - DEEP_WORK → BROWSING = opportunity
│  4. User Availability  │    - Check idle time
│  5. Relevance          │    - Do I have something meaningful to say?
└────────┬───────────────┘
         ↓ (PASS)
┌────────────────────────┐
│  Memory Retrieval      │
│  • Vector search       │ ← sqlite-vec (cosine similarity)
│  • Keyword search      │ ← SQLite FTS5
│  • Reranking           │ ← Cross-encoder (top 3)
└────────┬───────────────┘
         ↓
┌────────────────────────┐
│  Prompt Construction   │
│  • System prompt       │ (Companion identity + constraints)
│  • CCM injection       │ (User facts, patterns, tone calibration)
│  • Retrieved context   │ (Top 3 relevant memories)
│  • User message        │
└────────┬───────────────┘
         ↓
┌────────────────────────┐
│  Ollama (Local LLM)    │ → llama3.1:8b
└────────┬───────────────┘
         ↓
┌────────────────────────┐
│  Response + Grounding  │
│  • Streaming response  │
│  • Groundedness score  │ (NLI verification: 0.0–1.0)
│  • Memory ingestion    │ (Embed for future retrieval)
└────────────────────────┘
```

### Key Design Decisions

- **Why local?** Privacy is non-negotiable. Your thoughts stay on your device.
- **Why sqlite-vec?** No separate vector DB process. One SQLite file = entire system state.
- **Why gates?** LLMs default to "always respond." Gates enforce restraint—a production AI must know when *not* to speak.
- **Why reranking?** Vector search alone has 60-70% precision. Cross-encoder reranking pushes this to 85%+.

---

## 🤖 Core AI Systems

### 1. Activity Monitoring

**8 Activity States** (deterministic classification):

| State | Trigger | Companion Behavior |
|-------|---------|-------------------|
| `DEEP_WORK` | VS Code, Cursor, Xcode, etc. | Hidden or minimized—absolute silence |
| `STUDY` | Anki, Notion, books | Quiet mode, low-priority check-ins only |
| `BROWSING` | Chrome, Safari, Firefox | Fully visible, standard priority |
| `COMMUNICATION` | Slack, Discord, Email | Visible, medium priority |
| `MEDIA` | Spotify, YouTube, Netflix | Visible but passive |
| `GAMING` | Steam, League, Unity Editor | Fully hidden (opacity 0%) |
| `VIDEO_CALL` | Zoom, Meet, Teams | Fully hidden + excluded from screen capture |
| `IDLE` | No active window for 5+ minutes | Visible, low-priority wellness check |

**Transition Detection:** DEEP_WORK → BROWSING triggers high-priority agent run (you just finished focused work—time to check in).

---

### 2. Interruption Intelligence (5-Gate System)

Every agent run must pass **all 5 gates sequentially**. Fail any gate → silence.

#### Gate 1: Focus State
**Rule:** Never interrupt during `DEEP_WORK`, `GAMING`, or `VIDEO_CALL`.
**Rationale:** These states demand complete attention. Any interruption destroys flow.

#### Gate 2: Time Since Last Interaction
**Rule:** Minimum 30 minutes since last companion message (configurable: relaxed/normal/active).
**Rationale:** Prevents spammy behavior. The companion earns its place by showing restraint.

#### Gate 3: Transition Moment Detection
**Rule:** Prioritize runs immediately after leaving `DEEP_WORK` or `STUDY`.
**Rationale:** Natural breakpoints = best time to reflect or check in.

#### Gate 4: User Availability
**Rule:** If user idle >5 minutes, lower priority. If actively typing/clicking, skip unless urgent.
**Rationale:** Don't interrupt active work, even in "safe" states.

#### Gate 5: Relevance Check
**Rule:** LLM generates a candidate message. If relevance score <0.7, discard.
**Rationale:** Only speak if you have something meaningful to say.

**Result:** Lumina initiates ~2-4 check-ins per day, not 40.

---

### 3. RAG Memory Pipeline

**Ingestion** (Asynchronous):
1. **Chunking:** Split long journal entries into 300-token chunks (200-token overlap)
2. **Embeddings:** Generate 768-dim vectors via `nomic-embed-text` (Ollama)
3. **Importance Scoring:** 1-5 scale based on length, depth, emotional markers
4. **Storage:** Insert into `memory_chunks` table with vector index

**Retrieval** (Hybrid):
1. **Vector Search:** `sqlite-vec` cosine similarity → top 20 candidates
2. **Keyword Search:** SQLite FTS5 full-text search → top 20 candidates
3. **Merge & Dedupe:** Combine results (max 30 unique chunks)
4. **Reranking:** Cross-encoder scores all 30 → return top 3
5. **Token Budget:** Compress to fit 2,000-token context window

**Performance Target:** <250ms p50 retrieval latency (measured in benchmarks)

---

### 4. Companion Core Memory (CCM)

A **structured JSON document** describing who you are:

```json
{
  "userFacts": {
    "occupation": "Software Engineer",
    "timezone": "PST",
    "preferred_language": "English"
  },
  "userPatterns": {
    "deep_work_hours": "9am-12pm",
    "preferred_check_in_time": "afternoon"
  },
  "relationshipNotes": {
    "communication_style": "Direct and concise",
    "topics_to_avoid": []
  },
  "toneCalibration": {
    "formal_casual": 3,  // 1=formal, 5=very casual
    "directness": 4,
    "humour": 3,
    "checkin_frequency": "normal"  // relaxed|normal|active
  },
  "version": 1
}
```

**How It Works:**
- **Injected into every LLM prompt** (compressed to save tokens)
- **Updated via user-approved proposals** (no auto-updates in MVP)
- **Viewable in Settings panel** (read-only for now)

**Why It Matters:** Generic chatbots are stateless. Lumina remembers your preferences and adapts over time.

---

## 📊 Metrics & Evaluation

### Groundedness Scores

Every chat response includes a **groundedness score** (0.0–1.0):

- **>0.85** — High confidence, fully grounded in retrieved context
- **0.70–0.85** — Moderate confidence, mostly grounded
- **<0.70** — Low confidence, may contain speculation or hallucination

**How It's Calculated:**
1. Extract claims from LLM response
2. Run NLI (Natural Language Inference) verification against retrieved chunks
3. Average entailment scores across all claims

**Why It Matters:** Transparency. You know when Lumina is guessing vs. recalling facts.

### Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Retrieval Latency (p50) | <250ms | ~180ms |
| Retrieval Latency (p95) | <500ms | ~320ms |
| Groundedness (avg) | >0.86 | 0.88 |
| Agent Initiation Rate | 2-4/day | 2.8/day (normal mode) |
| Dismissal Rate | <15% | 12% |

---

## 📁 Project Structure

```
lumina/
├── src/
│   ├── main/              # Electron main process
│   │   ├── activity/      # Activity monitoring + state classification
│   │   ├── agent/         # LangGraph agent with 5 gates
│   │   ├── ccm/           # Companion Core Memory management
│   │   ├── chat/          # Chat message handling + streaming
│   │   ├── db/            # SQLite schema + migrations
│   │   ├── ipc/           # IPC handlers + input validation
│   │   ├── memory/        # RAG pipeline (embed, retrieve, rerank)
│   │   ├── observability/ # Langfuse integration (optional)
│   │   └── tools/         # LLM tools (calculator, alarms, todos)
│   ├── preload/           # Electron preload (contextBridge)
│   ├── renderer/          # React frontend
│   │   └── src/
│   │       ├── components/  # CompanionCharacter, Chat, Settings
│   │       └── styles/      # Tailwind CSS
│   └── types/             # Shared TypeScript types
├── tests/
│   ├── unit/              # Vitest unit tests
│   ├── e2e/               # Playwright E2E tests
│   └── component/         # Accessibility tests
├── scripts/               # Benchmark & utility scripts
├── SECURITY.md            # Security architecture documentation
├── Lumina_PRD_v3.0.md     # Complete product requirements
└── package.json
```

---

## 🔒 Security

Lumina follows **Electron security best practices**:

- ✅ **contextIsolation: true** — Preload scripts run in isolated context
- ✅ **nodeIntegration: false** — Renderer cannot access Node.js APIs
- ✅ **Comprehensive IPC validation** — All 25+ handlers validate input types, lengths, and ranges
- ✅ **Content Security Policy** — Strict CSP with no external scripts
- ✅ **URL protocol allowlist** — Only http/https/system preferences allowed
- ✅ **0 production vulnerabilities** — All dependencies audited

See [SECURITY.md](./SECURITY.md) for complete security architecture and known issues.

---

## 🛣️ Roadmap

### Current Status: v0.1.0 Alpha (MVP)

**Implemented:**
- ✅ Activity monitoring (8 states)
- ✅ 5-gate interruption system
- ✅ RAG memory pipeline (embed, retrieve, rerank)
- ✅ Companion Core Memory (manual updates)
- ✅ Chat with streaming + groundedness scores
- ✅ Journal (prompted + freeform)
- ✅ Mood tracking (4-emoji vibe check)
- ✅ Todo list integration
- ✅ Local observability (SQLite metrics)
- ✅ Optional Langfuse tracing

**In Progress:**
- 🚧 Companion character animations (placeholder CSS)
- 🚧 Onboarding flow

**Future (Post-MVP):**
- 🔮 CCM auto-update agent loop (high-risk, postponed)
- 🔮 Voice input/output
- 🔮 Calendar/health app integrations
- 🔮 Mobile companion view
- 🔮 Gamification system (XP, streaks, quests)
- 🔮 Multi-user support

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include: OS version, Ollama version, steps to reproduce
- For bugs: attach logs from `~/Library/Logs/Lumina/lumina-main.log` (macOS) or `%APPDATA%/Lumina/logs/lumina-main.log` (Windows)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes:
   - Follow TypeScript strict mode (no `any` types)
   - Add tests for new features
   - Run `npm run typecheck` and `npm test`
   - Ensure E2E tests pass (`npm run test:e2e:smoke`)
4. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
5. Push to your fork and open a Pull Request

### Code Style

- **TypeScript:** Strict mode, explicit return types, no implicit `any`
- **React:** Functional components with hooks, no class components
- **IPC Security:** All handlers must validate input (see `src/main/ipc/validators.ts`)
- **Async/Await:** Prefer `async`/`await` over `.then()` chains
- **File Structure:** One component per file, clear separation of concerns

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Ollama](https://ollama.com/) — Local LLM inference
- [Electron](https://www.electronjs.org/) — Desktop framework
- [LangChain](https://js.langchain.com/) — Agent orchestration
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — Vector search in SQLite
- [@paymoapp/active-window](https://github.com/paymoapp/node-active-window) — Native window detection

Inspired by the privacy-first AI movement and the belief that your thoughts shouldn't require a cloud subscription.

---

## 👤 Author

**Aryan Adhikari**

- Portfolio: [Your Portfolio Link]
- GitHub: [@yourusername](https://github.com/yourusername)
- Built as a portfolio project demonstrating production-grade AI engineering

---

## 🤖 Note to AI Coding Assistants (Cursor, Copilot, Claude Code)

If you're an AI helping develop Lumina, please follow these critical constraints:

### Architecture Rules (DO NOT VIOLATE)

1. **Type Safety**
   - Never disable TypeScript strict mode
   - Never use `any` types—always provide explicit types
   - All function signatures must have explicit return types

2. **IPC Security** (`src/main/ipc/index.ts`)
   - ALL IPC handlers must validate input using `src/main/ipc/validators.ts`
   - String inputs must have length limits (default maxLength: 10,000)
   - Numeric IDs must be positive integers
   - Enum values must use `validateEnum()` with allowlist

3. **Memory Pipeline** (`src/main/memory/`)
   - Embedding and retrieval are **asynchronous**—never block the main thread
   - Use `setImmediate()` for background ingestion after user actions
   - Worker threads for reranking (see `rerank.worker.ts`)
   - Retrieval latency target: <250ms p50

4. **Agent Gates** (`src/main/agent/`)
   - The 5-gate system is **sequential**—order matters
   - Gates return `{ pass: boolean, reason: string }`
   - Never skip gates or change their order
   - See PRD section 4.16 for gate logic

5. **Electron Security** (`src/main/window.ts`)
   - **NEVER** enable `nodeIntegration` in BrowserWindow
   - **NEVER** disable `contextIsolation`
   - `sandbox: false` is intentional (see SECURITY.md for justification)
   - All renderer-main communication goes through preload (`src/preload/index.ts`)

6. **Database Schema** (`src/main/db/schema.ts`)
   - Do NOT modify schema without migration script
   - sqlite-vec extension required for vector search
   - All timestamps use ISO 8601 strings

### Documentation

- **PRD:** `Lumina_PRD_v3.0.md` — Complete product requirements (source of truth)
- **Security:** `SECURITY.md` — Security architecture and threat model
- **Architecture:** This README + inline code comments

### Before Making Changes

1. Read the relevant section of `Lumina_PRD_v3.0.md`
2. Check `SECURITY.md` if touching IPC, Electron config, or data handling
3. Run `npm run typecheck` before committing
4. Ensure E2E tests pass (`npm run test:e2e:smoke`)

**When in doubt, ask the user before modifying core systems.**

---

<div align="center">

**Built with ❤️ and a commitment to privacy**

⭐ Star this repo if you believe AI should respect your thoughts

</div>
