/**
 * Settings Panel — Phase 8
 *
 * Provides UI for all AppSettings keys.
 * Each control calls window.lumina.settings.set immediately on change.
 */
import React, { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

const DEFAULT_SETTINGS: AppSettings = {
  model:                  'llama3.1:8b',
  activityMonitorEnabled: true,
  checkinFrequency:       'normal',
  observability:          'off',
  langfuseKey:            '',
  onboardingComplete:     false
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const { settings } = await window.lumina.settings.get()
    return settings as AppSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  await window.lumina.settings.set({ key, value })
}

interface SystemStatus {
  ollamaOk: boolean
  activityDegraded: boolean
}

interface Metrics {
  latency_p50: number | null
  groundedness_avg: number | null
  initiation_rate: number | null
  dismissal_rate: number | null
  llm_call_count?: number
  agent_event_count?: number
}

function fmtMs(v: number | null): string {
  return v !== null ? `${v}ms` : '–'
}
function fmtPct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : '–'
}

export default function Settings({ onClose }: Props): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState<SystemStatus>({ ollamaOk: false, activityDegraded: false })
  const [retrying, setRetrying] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    loadSettings().then(setSettings)
    window.lumina.system.getStatus().then(setStatus)
    window.lumina.metrics.get().then(setMetrics).catch(() => {})
  }, [])

  const retryEmbeddings = async () => {
    setRetrying(true)
    try {
      const result = await window.lumina.system.retryEmbeddings()
      setStatus(prev => ({ ...prev, ollamaOk: result.ollamaOk }))
    } finally {
      setRetrying(false)
    }
  }

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSaving(key)
    try {
      await saveSetting(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col w-[320px] h-[400px] rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: 'rgba(15, 10, 30, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-white/90 text-sm font-medium">Settings</span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
        >×</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 lumina-scroll">

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-[10px] uppercase tracking-wider">AI Model</label>
          <select
            value={settings.model}
            onChange={e => update('model', e.target.value)}
            className="bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-400/50 transition-colors"
          >
            <option value="llama3.1:8b">Llama 3.1 8B (recommended)</option>
            <option value="phi3:mini">Phi-3 Mini (faster)</option>
          </select>
        </div>

        {/* Activity monitor */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm">Activity Monitor</p>
            <p className="text-white/30 text-xs">Detects your working context</p>
          </div>
          <button
            onClick={() => update('activityMonitorEnabled', !settings.activityMonitorEnabled)}
            className={`
              w-10 h-6 rounded-full transition-colors duration-200 relative
              ${settings.activityMonitorEnabled ? 'bg-violet-500' : 'bg-white/15'}
            `}
          >
            <span className={`
              absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200
              ${settings.activityMonitorEnabled ? 'translate-x-[22px]' : 'translate-x-1'}
            `} />
          </button>
        </div>

        {/* Check-in frequency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-[10px] uppercase tracking-wider">Check-in Frequency</label>
          <div className="flex gap-2">
            {(['relaxed', 'normal', 'active'] as const).map(freq => (
              <button
                key={freq}
                onClick={() => update('checkinFrequency', freq)}
                className={`
                  flex-1 py-1.5 rounded-xl text-xs capitalize transition-all
                  ${settings.checkinFrequency === freq
                    ? 'bg-violet-500/50 text-violet-200 border border-violet-400/30'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Observability */}
        <div className="flex flex-col gap-1.5">
          <label className="text-white/50 text-[10px] uppercase tracking-wider">Observability</label>
          <div className="flex gap-2">
            {(['off', 'local', 'langfuse'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => update('observability', mode)}
                className={`
                  flex-1 py-1.5 rounded-xl text-xs capitalize transition-all
                  ${settings.observability === mode
                    ? 'bg-violet-500/50 text-violet-200 border border-violet-400/30'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                {mode}
              </button>
            ))}
          </div>
          {settings.observability === 'langfuse' && (
            <input
              type="password"
              value={settings.langfuseKey}
              onChange={e => update('langfuseKey', e.target.value)}
              placeholder="Langfuse API key"
              className="bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-400/50 transition-colors"
            />
          )}
        </div>

        {/* System Status */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <label className="text-white/50 text-[10px] uppercase tracking-wider">System Status</label>

          <div className="flex items-center justify-between">
            <span className="text-white/60 text-xs">Ollama</span>
            <div className="flex items-center gap-2">
              {status.ollamaOk ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Offline
                </span>
              )}
              <button
                onClick={retryEmbeddings}
                disabled={retrying}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-white/8 text-white/40 hover:text-white/70 hover:bg-white/12 transition-all disabled:opacity-40"
              >
                {retrying ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/60 text-xs">Activity Monitor</span>
            {status.activityDegraded ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-amber-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Degraded
                </span>
                <button
                  onClick={() => window.lumina.system.openUrl(
                    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
                  )}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-white/8 text-white/40 hover:text-white/70 hover:bg-white/12 transition-all"
                >
                  Fix
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Active
              </span>
            )}
          </div>

          {status.activityDegraded && (
            <p className="text-white/25 text-[10px] leading-relaxed">
              Grant Accessibility access in System Preferences → Privacy &amp; Security → Accessibility
            </p>
          )}
          {!status.ollamaOk && (
            <p className="text-white/25 text-[10px] leading-relaxed">
              Run <span className="font-mono text-white/40">ollama serve</span> to enable chat and memory
            </p>
          )}
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <label className="text-white/50 text-[10px] uppercase tracking-wider">Performance Metrics</label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-white/40 text-[10px]">Latency p50</span>
              <span className="text-white/70 text-[10px] text-right">{fmtMs(metrics.latency_p50)}</span>
              <span className="text-white/40 text-[10px]">Groundedness</span>
              <span className="text-white/70 text-[10px] text-right">{fmtPct(metrics.groundedness_avg)}</span>
              <span className="text-white/40 text-[10px]">Initiation rate</span>
              <span className="text-white/70 text-[10px] text-right">{fmtPct(metrics.initiation_rate)}</span>
              <span className="text-white/40 text-[10px]">Dismissal rate</span>
              <span className="text-white/70 text-[10px] text-right">{fmtPct(metrics.dismissal_rate)}</span>
              {metrics.llm_call_count !== undefined && (
                <>
                  <span className="text-white/40 text-[10px]">LLM calls</span>
                  <span className="text-white/70 text-[10px] text-right">{metrics.llm_call_count}</span>
                </>
              )}
            </div>
          </div>
        )}

        {saving && (
          <p className="text-violet-400/60 text-[10px] text-center animate-pulse">Saving…</p>
        )}
      </div>
    </div>
  )
}
