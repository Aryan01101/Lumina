# PRD — Refill Approval Queue

## Problem
Veronica (Care GP's voice AI receptionist) handles inbound prescription
refill calls and captures structured data. Clinic staff need a real-time
dashboard to review and approve these requests before they are sent to
the pharmacy.

## Users
Clinic receptionist / admin staff at a GP clinic.

## Features

### 1. Live Approval Queue (/queue)
- Shows all pending refill requests in real time
- New requests appear instantly without page refresh (Supabase Realtime)
- Each request shows: patient name, medication, dosage, time received
- Approve and Reject buttons on each request
- Once actioned, request disappears from the queue
- If two staff click approve simultaneously, only one succeeds
  (concurrency safe)

### 2. Simulate Agent Button
- A button that inserts a fake refill request into the database
- Purpose: demonstrate the real-time update live during a screen share
- Shows patient name, random medication from a preset list

### 3. Audit Log (/audit)
- Table of every action taken
- Columns: request ID, patient, medication, action, acted by, timestamp
- Most recent first
- Read only — no interactions

## Out of Scope
- Authentication
- Multiple clinics
- Actual voice integration
- Email/SMS notifications
- Mobile responsiveness (desktop only is fine)

## Definition of Done
- Deployed on Vercel with a public URL
- Real-time update works on screen share
- Approve action is concurrency safe
- Every action appears in the audit log
- No TypeScript errors
- No console errors
