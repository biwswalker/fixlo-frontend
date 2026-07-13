---
id: "0004"
title: PII display-masking with audit, plus password redaction at ingestion
status: accepted
date: 2026-07-14
relates: ["crm 0001", "crm 0002"]
tags: [crm, security, pii, pdpa, rbac]
---

# ADR 0004 — PII masking + password redaction

## Context

CRM chat contains heavy PII: full name, phone, bank account/number — required to process
withdrawals. The reviewed export also shows an admin typing a **customer's password in
plaintext** (`ยูส 0802518587 / รหัสผ่าน Niiza1122`). PDPA/GDPR posture is a hard
requirement (blueprint §5).

Service work **needs the real** name/phone/bank, so scrubbing PII at ingestion is not an
option — an agent cannot process a withdrawal to a masked account number. Passwords, by
contrast, must **never** be stored or shown.

## Decision

1. **PII: store raw, mask on display by `crm_role`, audit unmask.**
   - `phone_number`, `bank_account`, `address` stored raw (ops need them).
   - **`junior`** sees masked: phone `081-XXX-XX89`; bank account hidden except last
     digits; address = province + postcode only.
   - **`supervisor` / owner** see full values.
   - Every **unmask** action ("ดูข้อมูลเต็ม") writes an **audit log**: who, when, whose
     PII, which field. Non-repudiable, reviewable.
   - (Blueprint's stricter "junior sees full shipping only after order = paid" is a
     sales-model rule; dropped with the funnel — see
     [ADR 0003](0003-service-desk-reframe.md). Revisit if an order model returns.)

2. **Password: redact at ingestion, for all roles.**
   - n8n detects password-like patterns (`รหัสผ่าน` / `password` / `รหัส` followed by a
     token) in **any** message (customer or admin) and stores/shows `[REDACTED]`. No role
     can unmask it — it is never persisted in clear.
   - This is defence-in-depth, not a fix: **admins must not put player passwords in
     chat**. Flagged to the business as a process issue — use a reset link instead. A
     future guardrail may warn the agent inline when they type a password pattern.

3. **Masking is server-side.** Values are masked in the query/serializer layer by role
   before reaching the client — never sent full to a `junior` browser and hidden with CSS.
   Looker Studio cannot do this, which is why KPI is built in-app
   ([ADR 0003](0003-service-desk-reframe.md)).

## Consequences / risks

- Auditable unmask trail satisfies PDPA "who accessed what" and deters casual snooping.
- Pattern-based password redaction has false negatives (obfuscated passwords) and false
  positives (the word "รหัส" meaning a code) — accepted; err toward redacting, and pair
  with the process fix.
- Server-side masking means KPI/exports must also respect role — one masking helper,
  applied everywhere PII is serialized, not per-page.
- Raw PII at rest still needs DB-level protection (access control, backups) — out of scope
  here but noted.

## Alternatives considered

- **Scrub all PII at ingestion** — rejected: withdrawals need the real bank account;
  breaks the job.
- **Client-side masking (CSS/JS hide)** — rejected: full value still reaches the browser;
  trivially bypassed; not real access control.
- **Store passwords masked but unmaskable by owner** — rejected: passwords must never be
  retained; there is no legitimate reason to ever read them back.
