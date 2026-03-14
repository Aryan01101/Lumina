/**
 * Onboarding — shown on first launch (onboardingComplete === false).
 * Checks Ollama availability and macOS Accessibility permission,
 * then lets the user continue once setup looks good (or skip).
 */
import React, { useEffect, useState } from 'react'

interface Props {
  onComplete: () => void
}

interface SystemStatus {
  ollamaOk: boolean
  activityDegraded: boolean
}

interface PullModelState {
  status: string
  pct:    number
  done:   boolean
}

export default function Onboarding({ onComplete }: Props): React.ReactElement {
  const [status, setStatus]       = useState<SystemStatus>({ ollamaOk: false, activityDegraded: false })
  const [pullState, setPullState]  = useState<Record<string, PullModelState>>({})
  const [checking, setChecking]   = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    window.lumina.system.getStatus().then(setStatus)
  }, [])

  // Subscribe to model pull progress events
  useEffect(() => {
    const unsub = window.lumina.system.onPullProgress((p) => {
      setPullState(prev => ({
        ...prev,
        [p.model]: {
          status: p.status,
          pct:    p.total > 0 ? Math.round((p.completed / p.total) * 100) : (p.done ? 100 : 0),
          done:   p.done
        }
      }))
      if (p.done) {
        window.lumina.system.getStatus().then(setStatus)
      }
    })
    return unsub
  }, [])

  // Subscribe to system:status push events (fires when all models ready)
  useEffect(() => {
    const unsub = window.lumina.system.onStatus(setStatus)
    return unsub
  }, [])

  const refresh = async () => {
    setChecking(true)
    try {
      const s = await window.lumina.system.getStatus()
      setStatus(s)
    } finally {
      setChecking(false)
    }
  }

  const finish = async (skip: boolean) => {
    if (completing) return
    setCompleting(true)
    if (!skip) {
      await window.lumina.system.retryEmbeddings().catch(() => {})
    }
    await window.lumina.settings.set({ key: 'onboardingComplete', value: true })
    onComplete()
  }

  const allGood = status.ollamaOk && !status.activityDegraded

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(5, 3, 15, 0.92)', backdropFilter: 'blur(12px)', zIndex: 999 }}
    >
      <div
        className="flex flex-col gap-5 w-[320px] rounded-2xl px-6 py-6"
        style={{
          background: 'rgba(15, 10, 30, 0.98)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)'
        }}
      >
        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-lg font-semibold tracking-tight">Welcome to Lumina</h1>
          <p className="text-white/40 text-xs leading-relaxed">
            Your local AI companion. Let&apos;s make sure everything is ready.
          </p>
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-3">
          {/* Ollama */}
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/4">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">Ollama</span>
              {status.ollamaOk ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Starting…
                </span>
              )}
            </div>
            {Object.keys(pullState).length > 0 ? (
              <div className="flex flex-col gap-1.5 mt-0.5">
                {Object.entries(pullState).map(([model, state]) => (
                  <div key={model} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[10px] text-white/40">
                      <span className="font-mono">{model}</span>
                      <span>{state.done ? '✓' : `${state.pct}%`}</span>
                    </div>
                    {!state.done && (
                      <>
                        <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-violet-500 transition-all duration-300"
                            style={{ width: `${state.pct}%` }}
                          />
                        </div>
                        <p className="text-white/20 text-[9px]">{state.status}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : status.ollamaOk ? (
              <p className="text-white/30 text-[10px]">All models ready ✓</p>
            ) : (
              <p className="text-white/30 text-[10px] leading-relaxed">
                Ollama is auto-starting. If this takes a while, it may be downloading the binary.
              </p>
            )}
          </div>

          {/* Accessibility */}
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/4">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">Accessibility access</span>
              {!status.activityDegraded ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Granted
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Needed
                </span>
              )}
            </div>
            {status.activityDegraded && (
              <button
                onClick={() => window.lumina.system.openUrl(
                  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
                )}
                className="text-[10px] text-violet-400/80 hover:text-violet-300 transition-colors text-left"
              >
                Open System Preferences →
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={refresh}
            disabled={checking}
            className="w-full py-2 rounded-xl text-sm text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Refresh Status'}
          </button>

          <button
            onClick={() => finish(false)}
            disabled={completing}
            className={`
              w-full py-2 rounded-xl text-sm font-medium transition-all
              ${allGood
                ? 'bg-violet-500 hover:bg-violet-400 text-white'
                : 'bg-violet-500/30 text-violet-300/60 cursor-not-allowed'
              }
            `}
          >
            {completing ? 'Starting…' : 'Get Started'}
          </button>

          <button
            onClick={() => finish(true)}
            disabled={completing}
            className="text-white/20 hover:text-white/40 text-[11px] transition-colors text-center"
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  )
}
