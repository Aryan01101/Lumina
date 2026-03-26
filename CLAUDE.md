# CareGP Refill Approval Queue — Claude Code Instructions

## What This Is
A real-time prescription refill approval queue built to demonstrate
proficiency in Care GP's production stack before a founding engineer
interview. Maps directly to Veronica (their voice AI receptionist)
which captures refill requests and needs a dashboard for clinic staff
to approve them.

## Stack
- Next.js 14+ App Router (NOT Pages Router — never use pages/)
- TypeScript — strict mode, no any types
- Supabase — Postgres, Realtime, RLS
- Tailwind CSS — utility classes only, no custom CSS files
- Vercel — deployment target

## Architecture Rules
- Server Components by default — only use 'use client' when you need
  interactivity (useState, onClick, Realtime subscriptions)
- Server Actions for all mutations — no standalone API route files
  unless there's a specific reason
- All DB access goes through lib/supabase.ts — never initialise
  the client inline
- Never use any — TypeScript types for everything including
  Supabase responses

## Database Tables
- refill_requests — incoming requests from voice agent
- approval_actions — audit log, every action recorded

## Key Patterns
- Approval action uses conditional UPDATE WHERE status = 'pending'
  for concurrency safety — never a simple UPDATE
- Realtime subscription lives in a client component using useEffect
- Every approval must write to approval_actions for audit trail

## What NOT to Do
- Do not add authentication in this project — keep it simple
- Do not add multiple clinic support — single clinic only
- Do not use any UI component libraries — plain Tailwind only
- Do not create unnecessary abstraction layers
- Do not add features not listed in the PRD

## File Structure
app/
  page.tsx — redirects to /queue
  queue/
    page.tsx — server component, fetches initial data
    QueueClient.tsx — client component, Realtime subscription
    ApproveButton.tsx — client component, handles approve/reject
  audit/
    page.tsx — server component, audit log table
  actions.ts — all server actions
lib/
  supabase.ts — supabase client
  types.ts — shared TypeScript types
