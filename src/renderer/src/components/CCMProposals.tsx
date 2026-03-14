/**
 * CCM Proposal Review — Phase 8
 *
 * Shows pending companion core memory proposals for user accept/reject.
 */
import React, { useState } from 'react'
import type { CCMProposal } from '../../../main/ccm'

interface Props {
  proposals: CCMProposal[]
  onResolve: (id: number, accept: boolean) => Promise<void>
}

export default function CCMProposals({ proposals, onResolve }: Props): React.ReactElement | null {
  const [resolving, setResolving] = useState<number | null>(null)

  if (proposals.length === 0) return null

  const handleResolve = async (id: number, accept: boolean) => {
    setResolving(id)
    try {
      await onResolve(id, accept)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-t border-white/5">
      <p className="text-white/40 text-[10px] uppercase tracking-wider">Memory Proposals</p>
      {proposals.map(p => (
        <div
          key={p.id}
          className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-violet-400/10"
        >
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs leading-relaxed truncate">
              <span className="text-violet-300">{p.proposedKey}</span>
              {' '}→{' '}
              <span className="text-white/50">{String(p.proposedValue)}</span>
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => handleResolve(p.id, true)}
              disabled={resolving === p.id}
              className="px-2 py-0.5 rounded-lg bg-violet-500/40 hover:bg-violet-500/60 text-white/80 text-[10px] transition-colors disabled:opacity-40"
            >
              ✓
            </button>
            <button
              onClick={() => handleResolve(p.id, false)}
              disabled={resolving === p.id}
              className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 text-[10px] transition-colors disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
