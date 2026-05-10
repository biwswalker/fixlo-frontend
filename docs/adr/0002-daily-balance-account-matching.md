---
status: accepted
date: 2026-05-10
---

# Daily balance → project_account matching runs in spectre worker

Daily balance snapshots (BALANCE-type images from Discord) need to be matched to a `project_accounts` row so reconciliation can show per-account closing balance. We decided to run auto-matching inside the spectre worker at INSERT time — the same layer that already runs slip→account matching for transactions.

## Why not frontend-only

The frontend has a "Re-run matching" path for transactions, but initial matching for transactions also happens in the spectre worker. Keeping both match pipelines in the same layer avoids a class of race conditions where a balance row sits UNMATCHED until someone visits the frontend UI. The worker processes images immediately after Discord upload.

## Matching priority

P1: fuzzy `account_name` match against `project_accounts.account_name` + `aliases`. P2: `platform` (bank code from AI OCR) as tiebreaker when P1 returns multiple candidates. Threshold mirrors the existing slip matcher: ≥85 → AUTO_MAPPED, ≥50 → PENDING_REVIEW, else UNMATCHED.

PENDING_REVIEW rows surface in the `/match` page (new "ยอดบัญชีรายวัน" tab alongside the existing slip tab) where admin selects the correct account → MANUAL_MAPPED.

## Schema additions to `daily_balances`

- `project_account_id uuid NULL` — FK → `project_accounts.id`, set by matcher
- `matching_status text NOT NULL DEFAULT 'UNMATCHED'`
- `matched_by text NULL` — username of admin who manually matched
- `match_breakdown jsonb NULL` — top-3 candidates + component scores, mirrors `transactions.match_breakdown`
- `UNIQUE(date, discord_message_id)` — idempotency key; prevents duplicate rows if staff re-sends the same image

## Consequences

- spectre worker gains a second matcher call (after the existing slip smartMatcher)
- reconciliation `AccountLevelStat` gains `closingBalance` from matched daily_balances; accounts with UNMATCHED balances still appear (balance = null)
- inflow for a day is computed on-the-fly: `LAG(balance_amount)` + verified transaction outflows — not stored
- frontend migration owns the SQL (new columns + constraint); spectre reads the extended schema
