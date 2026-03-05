import React, { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const AUTO_CLOSE_DELAY_MS = 60_000

export default function CompanionPanel({ isOpen, onClose }: Props): React.ReactElement | null {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm Lumina. Chat will be available in Phase 6 once the AI backend is connected."
    }
  ])
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'journal'>('chat')
  const [journalText, setJournalText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Reset auto-close timer on any interaction
  const resetTimer = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    autoCloseTimer.current = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_DELAY_MS)
  }, [])

  useEffect(() => {
    if (isOpen) {
      resetTimer()
    } else {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
  }, [isOpen, resetTimer])

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendChat = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    resetTimer()

    // Phase 6: call window.lumina.chat.sendMessage(...)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Chat response coming in Phase 6 — the AI backend is not yet connected.'
        }
      ])
    }, 400)
  }

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

  if (!isOpen) return null

  return (
    <div
      className="flex flex-col w-[320px] h-[400px] rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: 'rgba(15, 10, 30, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
      }}
      onMouseMove={resetTimer}
      onKeyDown={resetTimer}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-white/90 text-sm font-medium">Lumina</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { setActiveTab('chat'); resetTimer() }}
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              activeTab === 'chat'
                ? 'bg-violet-500/30 text-violet-200'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => { setActiveTab('journal'); resetTimer() }}
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              activeTab === 'journal'
                ? 'bg-violet-500/30 text-violet-200'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Journal
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      {activeTab === 'chat' ? (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 lumina-scroll"
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-violet-600/70 text-white rounded-br-sm'
                      : 'bg-white/8 text-white/85 rounded-bl-sm'
                    }
                  `}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); resetTimer() }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendChat()
                  }
                }}
                placeholder="Say something..."
                className="
                  flex-1 bg-white/8 border border-white/10 rounded-xl
                  px-3 py-2 text-sm text-white placeholder-white/25
                  focus:outline-none focus:border-violet-400/50
                  transition-colors
                "
              />
              <button
                onClick={handleSendChat}
                disabled={!input.trim()}
                className="
                  w-9 h-9 rounded-xl bg-violet-500 hover:bg-violet-400
                  disabled:opacity-30 disabled:cursor-not-allowed
                  flex items-center justify-center
                  transition-all active:scale-95
                "
                aria-label="Send message"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Journal */}
          <div className="flex-1 px-4 py-3 flex flex-col gap-3">
            <p className="text-white/40 text-xs">Write freely — no form, no labels.</p>
            <textarea
              value={journalText}
              onChange={e => { setJournalText(e.target.value); resetTimer() }}
              placeholder="What's on your mind?"
              className="
                flex-1 bg-white/5 border border-white/10 rounded-xl
                px-3 py-2.5 text-sm text-white placeholder-white/20
                focus:outline-none focus:border-violet-400/50
                resize-none transition-colors lumina-scroll
              "
            />
          </div>
          <div className="px-4 py-3 border-t border-white/5">
            <button
              onClick={handleSaveJournal}
              disabled={journalText.trim().length < 10}
              className="
                w-full py-2 rounded-xl bg-violet-500/80 hover:bg-violet-500
                disabled:opacity-30 disabled:cursor-not-allowed
                text-white text-sm font-medium
                transition-all active:scale-[0.98]
              "
            >
              Save Entry
            </button>
          </div>
        </>
      )}
    </div>
  )
}
