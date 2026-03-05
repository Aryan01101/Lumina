/**
 * Augments the Window interface so renderer TypeScript code
 * can use window.lumina with full type safety.
 */
declare global {
  interface Window {
    lumina: {
      journal: {
        create: (payload: {
          content: string
          mode: 'prompted' | 'freeform'
          guidingQuestion?: string
        }) => Promise<{ id: number; created_at: string }>
      }
      chat: {
        sendMessage: (payload: { content: string; conversationId: string }) => Promise<{ ok: boolean }>
        onDelta: (callback: (delta: string) => void) => () => void
        onDone: (callback: (result: { groundedness_score: number | null }) => void) => () => void
      }
      mood: {
        log: (payload: {
          value: 'frustrated' | 'okay' | 'good' | 'amazing'
        }) => Promise<{ id: number }>
      }
      memory: {
        search: (query: string) => Promise<{ chunks: unknown[] }>
      }
      ccm: {
        get: () => Promise<{ ccm: unknown }>
        update: (payload: { section: string; data: unknown }) => Promise<{ ok: boolean }>
        onPropose: (callback: (proposal: { fact: string; source: string }) => void) => () => void
      }
      settings: {
        get: () => Promise<{ settings: unknown }>
        set: (payload: { key: string; value: unknown }) => Promise<{ ok: boolean }>
      }
      metrics: {
        get: () => Promise<{
          latency_p50: number | null
          groundedness_avg: number | null
          initiation_rate: number | null
          dismissal_rate: number | null
        }>
      }
      activity: {
        onStateChange: (callback: (state: { state: string; appName: string }) => void) => () => void
      }
      agent: {
        onStatus: (callback: (status: { actionType: string; message?: string }) => void) => () => void
      }
      window: {
        setIgnoreMouseEvents: (ignore: boolean) => void
      }
    }
  }
}

export {}
