# Security Architecture

This document outlines Lumina's security architecture, design decisions, and known issues.

## Electron Security Configuration

### ✅ Implemented Security Measures

**BrowserWindow Configuration** (`src/main/window.ts`):
- **contextIsolation: true** - Preload scripts run in isolated context, preventing renderer from accessing Node.js APIs
- **nodeIntegration: false** - Renderer process cannot directly access Node.js modules
- **sandbox: false** ⚠️ - See "Sandbox Mode Decision" below

**Content Security Policy** (`src/renderer/index.html`):
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
```
- **script-src 'self'** - No inline scripts allowed (strong XSS protection)
- **style-src 'self' 'unsafe-inline'** - Allows inline styles for Vite dev mode and Tailwind
  - Safe because: all code is bundled/local, Tailwind uses classes (not inline HTML styles), no remote content
  - Vite's dev server injects styles as `<style>` tags for HMR, requiring 'unsafe-inline'
  - Production builds could use stricter CSP with hashes, but not worth complexity for local-only app
- All resources must be from same origin ('self' only)

**IPC Security** (`src/main/ipc/index.ts`, `src/main/ipc/validators.ts`):
- All IPC handlers validate input types, lengths, and ranges
- String inputs have length limits (prevents DoS)
- Numeric IDs validated as positive integers
- Enum values strictly validated
- URLs validated and restricted to safe protocols (http, https, system preferences only)
- No raw IPC exposure to renderer (all wrapped in specific functions)

**Preload Script** (`src/preload/index.ts`):
- Uses `contextBridge.exposeInMainWorld` for all APIs
- Explicit channel allowlist (no generic message passing)
- No direct `ipcRenderer.send` or `ipcRenderer.invoke` exposed

## Sandbox Mode Decision

**Status:** Disabled (`sandbox: false`)

**Reason:**
Electron's sandbox mode provides additional process isolation but conflicts with our current architecture:

1. **Native Modules**: Lumina uses native Node.js modules (`better-sqlite3`, `@paymoapp/active-window`) that require Node.js APIs
2. **Preload Requirements**: Our preload script needs `require()` access to initialize database connections and native modules
3. **Performance**: Sandboxed mode would require IPC round-trips for all database operations, adding significant latency

**Risk Mitigation:**
- **contextIsolation: true** provides primary protection against prototype pollution
- **nodeIntegration: false** prevents renderer from directly accessing Node.js
- **Comprehensive IPC validation** prevents malicious payloads
- **Strict CSP** prevents XSS attacks
- **No remote content** - all code is bundled and local

**Future Consideration:**
If native modules are replaced with pure JavaScript alternatives, or if database operations are moved to a separate main process service, sandbox mode can be enabled.

## Known Vulnerabilities

### Dev Dependencies (Low Risk)

**Electron** (moderate severity):
- **Issue**: ASAR integrity bypass (GHSA-vmqv-hx8q-j7mg)
- **Risk**: Low - requires physical access or supply chain compromise
- **Status**: Tracked, will upgrade when breaking changes are resolved

**esbuild/vite** (moderate severity):
- **Issue**: Dev server can receive requests from any website
- **Risk**: Very Low - only affects development mode, not production
- **Mitigation**: Dev server runs on `localhost` only, not exposed to network

### Production Dependencies

**Status**: Zero vulnerabilities (as of last audit)

## Ollama Security

**Network Binding**: 127.0.0.1:11434 (localhost only)
- Not accessible from network or internet
- No CORS wildcards (`OLLAMA_ORIGINS` not set to `*`)
- Managed by electron-ollama for process isolation

## Data Security

**Local Storage**:
- Database: SQLite files stored in `app.getPath('userData')`
- No encryption at rest (data never leaves device)
- File system permissions managed by OS

**Memory**:
- No custom encryption schemes
- Standard Node.js crypto for any cryptographic operations
- Sensitive data not persisted in heap

## Security Update Process

1. Run `npm audit` regularly
2. Review and triage vulnerabilities by severity and risk
3. Add `overrides` in `package.json` for nested dependency fixes
4. Test after upgrades to ensure compatibility
5. Document decisions in this file

---

**Last Updated**: 2026-04-01
**Last Audit**: 2026-04-01 - 0 production vulnerabilities, 11 low/moderate dev-only vulnerabilities
