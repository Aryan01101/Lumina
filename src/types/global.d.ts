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
        sendMessage: (payload: { content: string; conversationId: string }) => Promise<{ ok: boolean; conversationId?: number; error?: string }>
        getHistory: (payload: { conversationId: number }) => Promise<{
          messages: Array<{
            id: number
            role: string
            content: string
            groundedness_score: number | null
            created_at: string
          }>
          error?: string
        }>
        listConversations: () => Promise<{
          conversations: Array<{
            id: number
            created_at: string
            last_message: string | null
            last_message_at: string | null
          }>
          error?: string
        }>
        onDelta: (callback: (delta: string) => void) => () => void
        onDone: (callback: (result: { groundedness_score: number | null; error?: string | null }) => void) => () => void
        onToolResult: (callback: (result: {
          tool: 'calculator' | 'alarm' | 'timer' | 'schedule'
          success: boolean
          data?: unknown
          message?: string
        }) => void) => () => void
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
        get: () => Promise<{ ccm: import('../main/ccm').CCMData | null }>
        update: (payload: { section: string; data: Record<string, unknown> }) => Promise<{ ok: boolean; error?: string }>
        resolve: (payload: { id: number; accept: boolean }) => Promise<{ ok: boolean; error?: string }>
        createProposal: (payload: { section: string; key: string; value: unknown }) => Promise<{ ok: boolean; id?: number; error?: string }>
        getPending: () => Promise<{ proposals: import('../main/ccm').CCMProposal[] }>
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
          llm_call_count: number
          agent_event_count: number
        }>
      }
      activity: {
        onStateChange: (callback: (state: { state: string; appName: string }) => void) => () => void
      }
      agent: {
        onStatus: (callback: (status: { actionType: string; message?: string }) => void) => () => void
      }
      system: {
        getStatus: () => Promise<{ ollamaOk: boolean; activityDegraded: boolean }>
        retryEmbeddings: () => Promise<{ ollamaOk: boolean }>
        openUrl: (url: string) => Promise<void>
        onStatus: (callback: (status: { ollamaOk: boolean; activityDegraded: boolean }) => void) => () => void
        onPullProgress: (callback: (progress: {
          model: string
          status: string
          completed: number
          total: number
          done: boolean
        }) => void) => () => void
      }
      log: {
        send: (payload: { level: 'log' | 'warn' | 'error'; args: unknown[] }) => void
      }
      window: {
        setIgnoreMouseEvents: (ignore: boolean) => void
        onTogglePanel: (callback: () => void) => () => void
      }
    }
  }
}

export {}
