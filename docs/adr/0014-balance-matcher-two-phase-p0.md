---
status: accepted
date: 2026-06-02
---

# Balance matcher: two-phase P0 with suffix match and M5 generic-alias guard

## Context

ADR 0005 added P0 (account_number exact match) as a hard gate before P1 name matching. P0 is evaluated inside `scoreAccount` per master and produces score 100, then the overall scoring sorts by score and picks the best. This means P0 is *not* a hard phase gate — a P1 alias exact match (score 100) on a different master ties with P0, and sort order is non-deterministic.

The incident of 2026-05-29 exposed two related failures:

1. **P0 failed silently on masked account numbers.** Thai bank apps mask middle digits on screenshots: OCR extracts `511-0-xxx378` for a BBL account whose full number in `project_accounts` is `5110651378`. After `normalizeAccountNumber` (strip `-, *, x`), `5110378 ≠ 5110651378` → P0 skipped → fell through to P1.

2. **A generic alias won P1 on the wrong account.** `บัญชีสะสมทรัพย์` ("savings account" — a generic account-type label) had been manually confirmed as an alias on account ศุณิษา. P1 matched it at score 100, AUTO_MAPPED to the wrong account.

Both failures compound: even if one is fixed, the other alone reproduces the wrong mapping.

## Decision

### Two-phase runBalanceMatch

Evaluate P0 across *all* masters before any P1 name logic runs. If P0 resolves the match, return immediately without entering Phase 2.

```
Phase 1 — P0 account_number (evaluated across ALL masters):
  exact match → normalize(scanned) == normalize(master) → score 100, AUTO_MAPPED (1 hit)
  suffix match → visible suffix of scanned ⊆ visible suffix of master (or vice versa) → score 90, AUTO_MAPPED (1 hit)
  >1 P0 hit → PENDING_REVIEW (ambiguous — admin resolves)
  0 P0 hits → fall to Phase 2

Phase 2 — P1 name+alias + P2 platform bonus (ADR 0005, unchanged):
  ≥85 → AUTO_MAPPED, ≥50 → PENDING_REVIEW, else UNMATCHED
```

### Visible-suffix extraction (`extractVisibleSuffix`)

Banks consistently show only the trailing digits after the mask block. Extract the digit run that follows the last `x/X/*` block; if no mask block, use the full normalized number. Examples:

- `511-0-xxx378` → `378`
- `710-0-xxx417` → `417`
- `xxx920` → `920`
- `06*-***-7141` → `7141`
- `5110651378` (no mask) → `5110651378`

Suffix comparison: `master_suffix.endsWith(scanned_suffix) || scanned_suffix.endsWith(master_suffix)` handles the full-vs-masked mismatch (master stores full, OCR returns masked, or vice versa).

### normalizeAccountNumber uppercase X fix

The existing normalizer stripped only lowercase `x`. Master accounts entered manually may use uppercase `X` (e.g. `XXX-X-XX230-0`). Updated regex: `/[-*xX\s]/g`.

### M5 generic-alias guard in proposeAliasAddition

Auto-alias append (ADR 0005) adds the OCR-extracted `account_name` to the master's alias list on `confirmBalanceMapping`. A new check (M5) silently skips the append when the scanned name appears in a blocklist of generic banking terms that describe account *type* rather than owner identity.

Initial blocklist: `บัญชีสะสมทรัพย์`, `บัญชีออมทรัพย์`, `ออมทรัพย์`, `สะสมทรัพย์`, `กระแสรายวัน`, `บัญชีกระแสรายวัน`, `savings account`, `current account`, `บัญชีเงินฝาก`.

M5 returns `reason: "generic_term"` (same silent-skip path as `"empty"` and `"duplicate"` — no warning surfaced to the user).

### batchReRunBalanceMatch query fix

The re-run SELECT was hardcoding `account_number: null`, bypassing P0 entirely for the re-run path. Now selects `db.account_number` and passes it to `runBalanceMatch`.

## Alternatives considered

- **score P0 suffix = 100 (same as exact).** Rejected. Two masters with identical suffix would both score 100 and produce a non-deterministic AUTO_MAPPED. Two-phase handles this as PENDING_REVIEW.
- **Normalize master account_number to masked format.** Rejected. Admin-entered data uses inconsistent formats (full digits, short masked, long masked). Normalizing at write time requires migration and UI validation. Suffix extraction handles all formats at read time.
- **Hard block generic aliases instead of silent skip.** Rejected. Surfacing a warning for every savings-account slip interrupts the confirm flow with noise the admin cannot fix. Silent skip is equivalent to the existing `"empty"` / `"duplicate"` paths.

## Consequences

- P0 suffix match closes the masked-account-number gap without requiring spectre OCR changes.
- Two-phase ensures account number is always a stronger signal than any name alias — consistent with how banks route by account number, not name.
- batchReRunBalanceMatch will now correctly re-match rows that were UNMATCHED/PENDING_REVIEW due to masked account numbers.
- Cross-repo: spectre worker has its own matcher copy. `fixlo-spectre` must apply the equivalent two-phase + suffix logic for the initial INSERT path (tracked in issue #106 cross-repo note).
- `extractVisibleSuffix` is exported from `balanceMatcher.ts` for testability.
- `GENERIC_ALIAS_BLOCKLIST` is exported from `accountAliases.ts` for testability and future extension.
