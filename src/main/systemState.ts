/**
 * Shared runtime state flags used across main-process modules.
 * Kept in a separate file to avoid circular imports between index.ts and ipc/index.ts.
 */

let _ollamaOk = false

export function setOllamaAvailable(ok: boolean): void {
  _ollamaOk = ok
}

export function isOllamaAvailable(): boolean {
  return _ollamaOk
}
