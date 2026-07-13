---
id: "0005"
title: Per-intent AI response policy (autopilot / copilot / force-human)
status: accepted
date: 2026-07-14
relates: ["crm 0002 (n8n)", "crm 0003 (service desk)", "crm 0004 (pii)"]
tags: [crm, ai, copilot, knowledge-base, safety]
---

# ADR 0005 — Per-intent AI response policy

## Context

The blueprint has the bot **auto-reply** (`direct_reply`) whenever confidence is high.
But this is a VIP, real-money channel where a wrong automated answer about a deposit or
withdrawal is expensive, and customers are sometimes already angry ("(furious)"). At the
same time, much of the real traffic is **safe, repetitive canned replies** (ask for
name/phone/bank, "รอสักครู่", deposit-account info) that a bot can handle.

The team wants automation **where it is safe** and human control **where it is
sensitive**, and wants to **configure this per intent inside Fixlo** — not hard-code it.

## Decision

Each knowledge-base intent carries a **`response_policy`**, configurable by a
`supervisor` in Fixlo, that governs how a match is answered.

1. **Three policies** (`bot_knowledge_base.response_policy`):
   - **`autopilot`** — n8n auto-sends `target_response` to the customer (via the outbound
     path, [ADR 0002](0002-n8n-owns-line-ingestion.md)). For unambiguous, safe intents.
   - **`copilot_suggest`** — n8n writes the proposed reply into the inbox as a **draft**;
     an admin reviews/edits and **sends**. Nothing reaches the customer without a human.
   - **`force_human`** — no AI reply; the session goes straight to the inbox as a human
     task (handoff).

2. **Sensitive intents are locked.** Intents flagged `is_sensitive` — **deposit,
   withdrawal, complaint** categories — are forced to `force_human` regardless of their
   `response_policy` value. The lock is enforced in n8n, not just the UI.

3. **Sentiment override.** If Gemini flags the customer turn as angry/frustrated, the turn
   is forced to `force_human` even when the matched intent is `autopilot`. Anger beats
   automation.

4. **Confidence gate first.** Below `bot_settings.confidence_threshold` (default 0.75) →
   no match → handoff, before policy is even considered.

5. **Decision order in n8n:** confidence gate → sensitive lock → sentiment override →
   `response_policy`. The first that applies wins; the safe default at every branch is
   handoff/human.

6. **Phase-1 default = `copilot_suggest`.** New/mined intents start as `copilot_suggest`.
   A supervisor promotes an intent to `autopilot` only after observing its draft quality.
   Widening autopilot coverage is an ongoing config task, not a code change.

## Consequences / risks

- Automation is opt-in per intent and reversible in the UI — the blast radius of a bad
  canned answer is controlled.
- Sensitive-category detection depends on correct intent tagging; a miscategorised
  deposit intent could slip to autopilot. Mitigation: `is_sensitive` set during KB review
  and defaulting money/complaint clusters to sensitive; audit auto-sent messages.
- Sentiment flagging has error; false "calm" on an angry customer could auto-reply.
  Mitigation: conservative threshold + sensitive lock already covers the money cases where
  anger usually appears.
- Storing `response_policy` + `is_sensitive` per intent makes `bot_knowledge_base` the
  single source of automation behaviour — n8n must read it live, not cache stale.

## Alternatives considered

- **Global autopilot on/off** — rejected: too coarse; the same channel needs bot canned
  replies and human money handling simultaneously.
- **Autopilot for everything above a confidence threshold** (blueprint) — rejected:
  confidence ≠ safety; a confident wrong answer about a withdrawal is the worst case.
- **Copilot-only, no autopilot ever** — rejected: wastes agent time on obvious canned
  replies the team already sends verbatim.
- **Hard-code the sensitive categories in n8n only** — rejected: business must retune
  which intents are safe without a deploy; hence per-intent config in Fixlo.
