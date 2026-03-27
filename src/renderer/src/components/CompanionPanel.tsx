/**
 * Companion Panel — Phase 8
 *
 * Full implementation:
 * - Chat tab: streaming Ollama responses via onDelta/onDone
 * - Journal tab: freeform save
 * - Mood tab: 4-emoji vibe check (4h rate limit)
 * - CCM Proposals: accept/reject pending proposals
 *
 * Auto-closes after 60s inactivity.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import MoodCheck from './MoodCheck'
import CCMProposals from './CCMProposals'
import ToolResult from './ToolResult'
import FocusTab from './FocusTab'
import type { CCMProposal } from '../../../main/ccm'
import { formatGroundednessScore } from '../utils/format'

interface ToolResultData {
  tool: 'calculator' | 'alarm' | 'timer' | 'schedule' | 'add_todo' | 'complete_todo' | 'list_todos'
  success: boolean
  data?: unknown
  message?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  groundednessScore?: number | null
  isStreaming?: boolean
  toolResult?: ToolResultData
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'chat' | 'journal' | 'mood' | 'focus'

const AUTO_CLOSE_DELAY_MS = 60_000

export default function CompanionPanel({ isOpen, onClose }: Props): React.ReactElement | null {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string>('new')
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [journalText, setJournalText] = useState('')
  const [lastMoodLoggedAt, setLastMoodLoggedAt] = useState<string | null>(null)
  const [proposals, setProposals] = useState<CCMProposal[]>([])
  const [ollamaOk, setOllamaOk] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCloseRef = useRef(onClose)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const journalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  onCloseRef.current = onClose

  // ─── Load conversation history ───────────────────────────────────────────────

  const loadConversationHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true)

      // Get latest conversation or create new one
      const { conversations } = await window.lumina.chat.listConversations()

      if (conversations.length > 0) {
        // Load most recent conversation
        const latest = conversations[0]
        const { messages: historyMessages } = await window.lumina.chat.getHistory({
          conversationId: latest.id
        })

        // Convert DB messages to UI message format
        const uiMessages: Message[] = historyMessages.map((msg) => ({
          id: String(msg.id),
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          groundednessScore: msg.groundedness_score
        }))

        setMessages(uiMessages)
        setConversationId(String(latest.id))
      } else {
        // No conversations exist, start fresh with welcome message
        setMessages([
          { id: '0', role: 'assistant', content: "Hi! I'm Lumina. What's on your mind?" }
        ])
        setConversationId('new')
      }
    } catch (err) {
      console.error('[Panel] Failed to load conversation history:', err)
      // Fall back to welcome message on error
      setMessages([
        { id: '0', role: 'assistant', content: "Hi! I'm Lumina. What's on your mind?" }
      ])
      setConversationId('new')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadConversationHistory()
    }
  }, [isOpen, loadConversationHistory])

  // ─── Ollama status ───────────────────────────────────────────────────────────

  useEffect(() => {
    window.lumina.system.getStatus().then(s => setOllamaOk(s.ollamaOk))
    const unsub = window.lumina.system.onStatus(s => setOllamaOk(s.ollamaOk))
    return unsub
  }, [])

  // ─── Auto-close ─────────────────────────────────────────────────────────────

  const resetTimer = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    autoCloseTimer.current = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_DELAY_MS)
  }, [])

  useEffect(() => {
    if (isOpen) {
      resetTimer()
      loadProposals()
    } else {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
    return () => { if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current) }
  }, [isOpen, resetTimer])

  // ─── Focus Management ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return

    // Small delay to ensure DOM is ready
    const focusTimer = setTimeout(() => {
      if (activeTab === 'chat' && chatInputRef.current) {
        chatInputRef.current.focus()
      } else if (activeTab === 'journal' && journalTextareaRef.current) {
        journalTextareaRef.current.focus()
      } else if (activeTab === 'focus') {
        // Focus the todo input in FocusTab
        const focusInput = document.querySelector<HTMLInputElement>('[data-testid="focus-todo-input"]')
        if (focusInput) focusInput.focus()
      }
    }, 50)

    return () => clearTimeout(focusTimer)
  }, [isOpen, activeTab])

  // ─── Keyboard Navigation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Focus trap: keep focus within panel
      if (e.key === 'Tab' && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          // Shift+Tab: moving backwards
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          // Tab: moving forwards
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // ─── Scroll to bottom ────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ─── Streaming chat ──────────────────────────────────────────────────────────

  const handleSendChat = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const userMsgId = Date.now().toString()
    const assistantMsgId = (Date.now() + 1).toString()

    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: trimmed }])
    setInput('')
    setIsSending(true)
    resetTimer()

    // Add streaming placeholder
    setMessages(prev => [...prev, {
      id: assistantMsgId, role: 'assistant', content: '', isStreaming: true
    }])

    const offDelta = window.lumina.chat.onDelta((delta) => {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
      ))
    })

    const offToolResult = window.lumina.chat.onToolResult?.((toolResult: ToolResultData) => {
      // Insert tool result message before assistant response
      setMessages(prev => {
        const assistantIndex = prev.findIndex(m => m.id === assistantMsgId)
        if (assistantIndex === -1) return prev

        const toolMsgId = `${Date.now()}-tool`
        const toolMessage: Message = {
          id: toolMsgId,
          role: 'assistant',
          content: '',
          toolResult
        }

        const newMessages = [...prev]
        newMessages.splice(assistantIndex, 0, toolMessage)
        return newMessages
      })
    }) || (() => {})

    const offDone = window.lumina.chat.onDone(({ groundedness_score, error }) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== assistantMsgId) return m
        const fallback = (!m.content.trim() && error)
          ? 'Sorry, I could not reach the local model. Make sure Ollama is running and try again.'
          : m.content
        return { ...m, content: fallback, isStreaming: false, groundednessScore: groundedness_score }
      }))
      setIsSending(false)
      offDelta()
      offDone()
      offToolResult()
    })

    try {
      const result = await window.lumina.chat.sendMessage({ content: trimmed, conversationId }) as
        | { ok: boolean; conversationId?: number; error?: string }
        | { conversationId?: number; error?: string }
      if ('error' in result && result.error) {
        throw new Error(result.error)
      }
      if ('ok' in result && result.ok === false) {
        throw new Error(result.error ?? 'Chat request failed')
      }
      if (result.conversationId) setConversationId(String(result.conversationId))
    } catch (err) {
      console.error('[Panel] chat:message failed', err)
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: 'Sorry, something went wrong. Is Ollama running?', isStreaming: false }
          : m
      ))
      setIsSending(false)
      offDelta()
      offDone()
      offToolResult()
    }
  }, [input, isSending, conversationId, resetTimer])

  // ─── Journal ─────────────────────────────────────────────────────────────────

  const handleSaveJournal = async () => {
    const trimmed = journalText.trim()
    if (trimmed.length < 10) return
    try {
      await window.lumina.journal.create({ content: trimmed, mode: 'freeform' })
      setJournalText('')
      resetTimer()
    } catch (err) {
      console.error('[Panel] journal:create failed', err)
    }
  }

  // ─── Mood ────────────────────────────────────────────────────────────────────

  const handleLogMood = async (value: 'frustrated' | 'okay' | 'good' | 'amazing') => {
    await window.lumina.mood.log({ value })
    setLastMoodLoggedAt(new Date().toISOString())
    resetTimer()
  }

  // ─── CCM Proposals ───────────────────────────────────────────────────────────

  const loadProposals = async () => {
    try {
      const { proposals: pending } = await window.lumina.ccm.getPending()
      setProposals(pending)
    } catch { /* non-critical */ }
  }

  const handleResolveProposal = async (id: number, accept: boolean) => {
    await window.lumina.ccm.resolve({ id, accept })
    setProposals(prev => prev.filter(p => p.id !== id))
  }

  if (!isOpen) return null

  return (
    <aside
      ref={panelRef}
      data-testid="companion-panel"
      className="flex flex-col w-[320px] rounded-2xl overflow-hidden animate-slide-up"
      style={{
        height: proposals.length > 0 ? '460px' : '400px',
        background: 'rgba(15, 10, 30, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
      }}
      onMouseMove={resetTimer}
      onKeyDown={resetTimer}
      role="complementary"
      aria-label="Lumina companion panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-white/90 text-sm font-medium">Lumina</span>
        </div>
        <nav className="flex gap-1" data-testid="companion-tabs" role="navigation" aria-label="Panel tabs">
          {(['chat', 'focus', 'journal', 'mood'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); resetTimer() }}
              className={`px-3 py-1 rounded-full text-xs transition-all capitalize ${
                activeTab === tab
                  ? 'bg-violet-500/30 text-violet-200'
                  : 'text-white/40 hover:text-white/70'
              }`}
              data-testid={`companion-tab-${tab}`}
              aria-label={`Switch to ${tab} tab`}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab}
            </button>
          ))}
        </nav>
        <button
          onClick={onClose}
          className="text-white/35 hover:text-white/70 transition-colors text-lg leading-none"
          aria-label="Close panel"
          data-testid="companion-close-button"
        >×</button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && (
          <>
            {!ollamaOk && (
              <div
                className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-[11px] leading-relaxed"
                role="status"
                aria-live="polite"
              >
                AI models are loading — responses will be available shortly.
              </div>
            )}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3 lumina-scroll"
              data-testid="companion-chat-messages"
              role="log"
              aria-live="polite"
              aria-label="Chat conversation"
            >
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-8 text-white/35 text-xs">
                  <span>Loading conversation...</span>
                </div>
              )}
              {!isLoadingHistory && messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {msg.toolResult ? (
                    <ToolResult {...msg.toolResult} />
                  ) : (
                    <>
                      <div className={`
                        max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-violet-600/70 text-white rounded-br-sm'
                          : 'bg-white/8 text-white/85 rounded-bl-sm'
                        }
                      `}>
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-flex gap-0.5 ml-1">
                            <span className="w-1 h-1 rounded-full bg-violet-300 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1 h-1 rounded-full bg-violet-300 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1 h-1 rounded-full bg-violet-300 animate-bounce [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                      {msg.role === 'assistant' && msg.groundednessScore != null && (
                        <span className="text-white/20 text-[9px] px-1">
                          {formatGroundednessScore(msg.groundednessScore)} grounded
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-white/5">
              <form
                className="flex gap-2 items-end"
                onSubmit={(e) => { e.preventDefault(); handleSendChat() }}
                role="search"
                aria-label="Send message"
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  value={input}
                  onChange={e => { setInput(e.target.value); resetTimer() }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() }
                  }}
                  disabled={isSending}
                  placeholder={isSending ? 'Thinking…' : 'Say something…'}
                  data-testid="companion-chat-input"
                  className="
                    flex-1 bg-[rgba(255,255,255,0.06)] border border-white/10 rounded-xl
                    px-3 py-2 text-sm text-white/90 placeholder-white/35
                    focus:outline-none focus:border-violet-400/50 focus:bg-[rgba(255,255,255,0.09)]
                    disabled:opacity-50 transition-colors
                  "
                  aria-label="Message input"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!input.trim() || isSending}
                  className="
                    w-9 h-9 rounded-xl bg-violet-500 hover:bg-violet-400
                    disabled:opacity-30 disabled:cursor-not-allowed
                    flex items-center justify-center transition-all active:scale-95
                  "
                  aria-label="Send message"
                  data-testid="companion-chat-send-button"
                >
                  <svg className="w-4 h-4 text-white rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'journal' && (
          <>
            <div className="flex-1 px-4 py-3 flex flex-col gap-3">
              <p className="text-white/40 text-xs" id="journal-description">Write freely — no form, no labels.</p>
              <textarea
                ref={journalTextareaRef}
                value={journalText}
                onChange={e => { setJournalText(e.target.value); resetTimer() }}
                placeholder="What's on your mind?"
                data-testid="companion-journal-textarea"
                className="
                  flex-1 bg-white/5 border border-white/10 rounded-xl
                  px-3 py-2.5 text-sm text-white placeholder-white/35
                  focus:outline-none focus:border-violet-400/50
                  resize-none transition-colors lumina-scroll
                "
                aria-label="Journal entry"
                aria-describedby="journal-description"
              />
            </div>
            <div className="px-4 py-3 border-t border-white/5">
              <button
                onClick={handleSaveJournal}
                disabled={journalText.trim().length < 10}
                className="
                  w-full py-2 rounded-xl bg-violet-500/80 hover:bg-violet-500
                  disabled:opacity-30 disabled:cursor-not-allowed
                  text-white text-sm font-medium transition-all active:scale-[0.98]
                "
                data-testid="companion-journal-save-button"
              >
                Save Entry
              </button>
            </div>
          </>
        )}

        {activeTab === 'mood' && (
          <div className="flex-1 px-4 py-3 flex items-center">
            <MoodCheck lastLoggedAt={lastMoodLoggedAt} onLog={handleLogMood} />
          </div>
        )}

        {activeTab === 'focus' && (
          <FocusTab resetTimer={resetTimer} />
        )}
      </div>

      {/* CCM Proposals */}
      {proposals.length > 0 && (
        <section role="region" aria-label="Pending proposals">
          <CCMProposals proposals={proposals} onResolve={handleResolveProposal} />
        </section>
      )}
    </aside>
  )
}
