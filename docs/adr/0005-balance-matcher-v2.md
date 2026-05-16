---
status: accepted
date: 2026-05-16
---

# Balance matcher v2 — alias substring, normalized fuzzy, account_number P0, self-improving aliases

Daily balance auto-matching (ADR 0002) leaves ~41% of recent `daily_balances` rows stuck at `UNMATCHED` (31 of 75 in production as of 2026-05-16). All stuck rows score 0 — none reach `PENDING_REVIEW`. Root causes break into three modes:

- **Mode A — Thai OCR typos.** Gemini extracts `account_name` with single-character errors (e.g. `"เกษม ติะแสนเทพ"` vs master `"เกษม ต๊ะแสนเทพ"`, `"คุณ ศุญิษา"` vs master `"ศุณิษา"`). The matcher's substring check fails because no full string is a substring of the other.
- **Mode B — Null `account_name`.** Gateway/e-wallet screenshots (TrueMoney, GSB) often produce `account_name = null` but a valid `platform`. With `nameScore = 0`, the platform bonus is gated off (`nameScore > 0 && bankMatched`) and the row scores 0.
- **Mode C — Aliases used only for exact equality.** `project_accounts.aliases` already lists short forms like `["เกษม", "ต๊ะแสนเทพ"]`, but `scoreAccount` checks `mAliases.includes(sName)` (full-string equality). OCR returning the long form misses the short alias.

Each manual confirmation (`MANUAL_MAPPED`) currently sets only `project_account_id`. The mangled scanned name is discarded, so the next identical OCR error reproduces the miss — no compounding signal.

We are upgrading the matcher and the manual-confirm flow in `fixlo-frontend`. The OCR-side fix (extract `acc_number`, improve `platform` reliability) is tracked as a separate cross-repo issue against `fixlo-spectre`.

## Decision

### Matcher scoring changes (`src/lib/balanceMatcher.ts`)

Add three new paths to `scoreAccount`, evaluated in priority order:

1. **P0 — account_number exact match (new).** If scanned has `account_number` (read from `raw_ai_output.acc_num` once the spectre OCR ships the field) and `master.account_number` is non-null and equal after normalization (strip `-`, `*`, `x`, whitespace) → `baseScore = 100`, `nameMatched = "none"`, `bankMatched` recorded but not used to add bonus. Graceful: if scanned `acc_num` is null/empty, skip this path silently.
2. **P1 — name + alias substring (extended).** Build a candidate set = `[master.account_name, ...aliases]`. For each candidate `c`:
   - exact equal (case + whitespace normalized) → name match `"exact"` or `"alias"`, score 100.
   - else, **token-based fuzzy** (see normalization below): if any token of normalized scanned name matches any token of `c` with Levenshtein distance ≤ 1, AND both tokens are ≥ 4 characters → name match `"partial"`, score 80.
   - else, full-string substring (existing behavior, retained as final fallback): score 80.
   - Take the highest-scoring candidate hit.
3. **P2 — platform bonus (unchanged).** `+10` if `nameScore > 0 && bankMatched`. Capped at 100.

Thresholds (`AUTO_THRESHOLD = 85`, `PENDING_THRESHOLD = 50`) and gateway-account short-circuit are unchanged.

### Name normalization (new, applied to both scanned and candidate strings before fuzzy comparison)

- Lowercase + trim.
- Strip leading honorifics from the token list: `คุณ`, `นาย`, `น.ส.`, `นางสาว`, `นาง`, `mr.`, `ms.`, `mrs.`.
- Collapse internal whitespace to a single space, split on whitespace to form tokens.
- Levenshtein is applied per-token, not on the full string. Rationale: full-string distance is dominated by prefix/suffix noise (`"คุณ ศุญิษา"` vs `"ศุณิษา"` has full distance 5; after token strip, comparing `"ศุญิษา"` vs `"ศุณิษา"` gives 1).
- Minimum token length 4 for Levenshtein matching. This prevents 3-character tokens like `"BBL"` and `"GSB"` (Levenshtein distance 2) from matching each other. Tokens < 4 chars only count via exact equality.

### Auto-alias on manual confirm (`src/actions/dashboard.ts`)

When `confirmBalanceMapping(dailyBalanceId, projectAccountId)` runs, also append the scanned `account_name` to the target master's alias list, subject to sanity checks:

- **Sanity check (M4):** if the scanned name (normalized) is already present as an alias (exact or normalized-equal) on any *other* `project_accounts` row, reject the auto-add and surface a warning in the server action response — do not silently break the cross-master alias.
- **Skip if already present** on the target master (no duplicate).
- **Skip if empty/null** scanned name (Mode B rows).

`createManualBalance` does not trigger auto-alias addition — the admin picks the account directly without an OCR-derived candidate name worth storing.

### Alias provenance (`project_accounts.aliases_meta`)

Add a new column `aliases_meta jsonb NULL` parallel to existing `aliases`. The `aliases` column remains the source of truth for the matcher (fast read, unchanged structure). `aliases_meta` is a write-side log of alias additions:

```json
[
  {
    "value": "เกษม ติะแสนเทพ",
    "added_by": "jennarong",
    "added_at": "2026-05-17T03:14:00Z",
    "source": "manual_confirm",
    "from_daily_balance_id": 97
  }
]
```

`source` values: `"manual_confirm"`, `"admin_edit"` (when admin manages aliases via the accounts UI), `"seed"` (initial data). Pre-existing aliases are not backfilled — only future additions get logged.

### Cross-repo scope (not in this ADR)

Spectre worker OCR prompt changes are tracked separately and are required before P0 (account_number match) becomes useful:

- Add `acc_num` to the Gemini extraction schema for BALANCE-type images.
- Investigate and reduce `platform` misreads (observed: BBL accounts reported as KBANK or KTB).

The matcher is being shipped in a state where P0 is graceful — if `acc_num` is missing from `raw_ai_output`, the path is skipped and the rest of the scoring runs as before. This lets the in-repo fix land independently of the spectre work.

## Alternatives considered

- **Lower `AUTO_THRESHOLD` from 85 to 80.** Rejected. Would auto-promote every current partial match, including ones with platform mismatches that should be reviewed. Also collides with Mode B (null name) which never reaches 80 to begin with.
- **Levenshtein on full strings.** Rejected. `"คุณ ศุญิษา"` (8 chars) vs `"ศุณิษา"` (6 chars) has full-string distance 3+, above any safe threshold. Token-based + honorific strip is the smallest change that catches real OCR errors without inflating false positives.
- **Auto-alias as a "pending" two-step trust system.** Rejected. Adds admin confusion ("I confirmed it, why is it still PENDING?") for no meaningful safety gain over M4's sanity check.
- **Replace `aliases` column with structured jsonb objects.** Rejected. Breaking change to the matcher hot path. The parallel `aliases_meta` column gives provenance without touching the read path.
- **Audit log in a separate table (`project_account_alias_log`).** Rejected. Adds a JOIN to admin views for marginal benefit; the per-account scope is small enough that an inline jsonb is fine.
- **Platform-only fallback for single-master gateways.** Deferred. Would only help when a `bank_code` maps to exactly one master (e.g. Apay → ACCTEAM). TrueMoney has 2 masters, GSB has 0. The acc_number P0 path subsumes this case more safely once OCR ships.

## Consequences

- Mode A (Thai OCR typos) and Mode C (alias short forms) are resolved in-repo as soon as this ships. Recent UNMATCHED rows like #97 (`"เกษม ติะแสนเทพ"`) and #95 (`"คุณ ศุญิษา"`) should match on `batchReRunBalanceMatch`.
- Mode B (null name) remains unsolved until the spectre OCR adds `acc_num`. Rows like #103 (TrueMoney) and #94 (GSB) stay UNMATCHED for now. GSB additionally has no master account at all — that is a domain question, not a matcher question.
- Each `confirmBalanceMapping` call now teaches the matcher. Repeat OCR patterns become AUTO_MAPPED on the next batch.
- `aliases_meta` is admin-debuggable. If a bad alias slips in (e.g. wrong manual confirm), the row identifies who added it, when, and from which `daily_balances` row.
- Migration: one `ALTER TABLE project_accounts ADD COLUMN aliases_meta jsonb NULL`. No data backfill.
- Matcher tests (`src/lib/__tests__/balanceMatcher.test.ts`) need cases for: alias partial substring (Mode C), token-Levenshtein with honorific strip (Mode A), short-token rejection (no BBL/GSB false positive), null acc_num graceful skip (Mode B path).
- `confirmBalanceMapping` server action gains alias-write side effects — its test surface needs an integration test that asserts the alias is appended on success and rejected on M4 violation.
