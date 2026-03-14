import { contextBridge, ipcRenderer } from 'electron'

/**
 * Exposes a typed, whitelisted API surface to the renderer process.
 * Only channels explicitly listed here can be accessed by renderer code.
 * nodeIntegration is disabled in renderer — this is the only bridge.
 *
 * Channel contracts defined in PRD section 5.3.
 */
contextBridge.exposeInMainWorld('lumina', {
  // ─── Journal ────────────────────────────────────────────────────────────
  journal: {
    create: (payload: { content: string; mode: 'prompted' | 'freeform'; guidingQuestion?: string }) =>
      ipcRenderer.invoke('journal:create', payload)
  },

  // ─── Chat ────────────────────────────────────────────────────────────────
  chat: {
    sendMessage: (payload: { content: string; conversationId: string }) =>
      ipcRenderer.invoke('chat:message', payload),

    getHistory: (payload: { conversationId: number }) =>
      ipcRenderer.invoke('chat:getHistory', payload),

    listConversations: () =>
      ipcRenderer.invoke('chat:listConversations'),

    onDelta: (callback: (delta: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, delta: string) => callback(delta)
      ipcRenderer.on('chat:delta', handler)
      return () => ipcRenderer.removeListener('chat:delta', handler)
    },

    onDone: (callback: (result: { groundedness_score: number | null; error?: string | null }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, result: { groundedness_score: number | null; error?: string | null }) =>
        callback(result)
      ipcRenderer.on('chat:done', handler)
      return () => ipcRenderer.removeListener('chat:done', handler)
    },

    onToolResult: (callback: (result: {
      tool: 'calculator' | 'alarm' | 'timer' | 'schedule'
      success: boolean
      data?: unknown
      message?: string
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, result: {
        tool: 'calculator' | 'alarm' | 'timer' | 'schedule'
        success: boolean
        data?: unknown
        message?: string
      }) => callback(result)
      ipcRenderer.on('chat:tool-result', handler)
      return () => ipcRenderer.removeListener('chat:tool-result', handler)
    }
  },

  // ─── Mood ────────────────────────────────────────────────────────────────
  mood: {
    log: (payload: { value: 'frustrated' | 'okay' | 'good' | 'amazing' }) =>
      ipcRenderer.invoke('mood:log', payload)
  },

  // ─── Memory ──────────────────────────────────────────────────────────────
  memory: {
    search: (query: string) => ipcRenderer.invoke('memory:search', { query })
  },

  // ─── CCM ─────────────────────────────────────────────────────────────────
  ccm: {
    get: () => ipcRenderer.invoke('ccm:get'),

    update: (payload: { section: string; data: Record<string, unknown> }) =>
      ipcRenderer.invoke('ccm:update', payload),

    resolve: (payload: { id: number; accept: boolean }) =>
      ipcRenderer.invoke('ccm:resolve', payload),

    createProposal: (payload: { section: string; key: string; value: unknown }) =>
      ipcRenderer.invoke('ccm:create-proposal', payload),

    getPending: () =>
      ipcRenderer.invoke('ccm:get-pending'),

    onPropose: (callback: (proposal: { fact: string; source: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, proposal: { fact: string; source: string }) =>
        callback(proposal)
      ipcRenderer.on('ccm:propose', handler)
      return () => ipcRenderer.removeListener('ccm:propose', handler)
    }
  },

  // ─── Settings ────────────────────────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (payload: { key: string; value: unknown }) => ipcRenderer.invoke('settings:set', payload)
  },

  // ─── Metrics ─────────────────────────────────────────────────────────────
  metrics: {
    get: () => ipcRenderer.invoke('metrics:get')
  },

  // ─── Activity state (pushed from main) ────────────────────────────────────
  activity: {
    onStateChange: (callback: (state: { state: string; appName: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: { state: string; appName: string }) =>
        callback(state)
      ipcRenderer.on('activity:state', handler)
      return () => ipcRenderer.removeListener('activity:state', handler)
    }
  },

  // ─── Agent status (pushed from main) ──────────────────────────────────────
  agent: {
    onStatus: (callback: (status: { actionType: string; message?: string }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        status: { actionType: string; message?: string }
      ) => callback(status)
      ipcRenderer.on('agent:status', handler)
      return () => ipcRenderer.removeListener('agent:status', handler)
    }
  },

  // ─── System Status ────────────────────────────────────────────────────────
  system: {
    getStatus: () =>
      ipcRenderer.invoke('system:status'),

    retryEmbeddings: () =>
      ipcRenderer.invoke('system:retry-embeddings'),

    openUrl: (url: string) =>
      ipcRenderer.invoke('shell:open-url', url),

    onStatus: (callback: (status: { ollamaOk: boolean; activityDegraded: boolean }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        status: { ollamaOk: boolean; activityDegraded: boolean }
      ) => callback(status)
      ipcRenderer.on('system:status', handler)
      return () => ipcRenderer.removeListener('system:status', handler)
    },

    onPullProgress: (callback: (progress: {
      model: string; status: string; completed: number; total: number; done: boolean
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, p: {
        model: string; status: string; completed: number; total: number; done: boolean
      }) => callback(p)
      ipcRenderer.on('system:pull-progress', handler)
      return () => ipcRenderer.removeListener('system:pull-progress', handler)
    }
  },

  // ─── Renderer logging ─────────────────────────────────────────────────────
  log: {
    send: (payload: { level: 'log' | 'warn' | 'error'; args: unknown[] }) =>
      ipcRenderer.send('log:renderer', payload)
  },

  // ─── Window control ───────────────────────────────────────────────────────
  window: {
    setIgnoreMouseEvents: (ignore: boolean) =>
      ipcRenderer.send('window:setIgnoreMouseEvents', ignore),

    onTogglePanel: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('shortcut:toggle-panel', handler)
      return () => ipcRenderer.removeListener('shortcut:toggle-panel', handler)
    }
  }
})
