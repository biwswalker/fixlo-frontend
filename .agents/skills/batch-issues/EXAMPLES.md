# batch-issues — worked run

A realistic pass over a PRD (`#206`) with four child issues. Commands are the
real `gh`/`git` shape; trim to your repo.

## 1. Resolve inputs + order

```bash
# Children of the PRD, with their "Blocked by" lines.
gh issue list --label ready-for-agent --state open \
  --json number,title,body --jq '.[] | {number, title}'
```

Read each body's **Blocked by**. Example dependency graph:

```
#208 (none) ┐
#207 (none) ┼─→ #209 (needs #207,#208) ─→ #210 (needs #209)
```

Order: `#208, #207` (unblocked) → `#209` → `#210`. Track as four tasks with
`blockedBy` links; mark each done only when its PR merges.

## 2. One issue, start to merge (#208)

```bash
git switch master && git fetch origin && git reset --hard origin/master
git switch -c feat/208-counter-price-policy
```

Run `/implement` against #208 — it builds with TDD internally at pre-agreed
seams (e.g. `src/lib/pricing/counter.test.ts` red → green, one behaviour at a
time), typechecks, runs the full test suite, and commits once done:

```bash
# inside /implement: write the migration, regen + validate before relying on
# generated types
npx prisma generate && npx prisma validate
```

Push + open the PR:

```bash
git push -u origin feat/208-counter-price-policy
gh pr create --title "…" --body "Closes #208 · Part of #206 …"        # acceptance ticked
```

Review + fix loop until clean:

```
/code-review            # apply confirmed findings → re-run the full checks → push → re-review
```

Wait for CI; re-run an infra flake rather than "fixing" it:

```bash
gh pr checks <pr> --watch
# a check shows conclusion "cancelled" (not a real failure):
gh run rerun <run-id> --failed && gh pr checks <pr> --watch
```

Merge + sync:

```bash
gh pr merge <pr> --squash --delete-branch
git switch master && git fetch origin && git reset --hard origin/master
```

Mark the task done. `#208` merged unblocks nothing new yet; continue with `#207`,
then `#209` (now eligible), then `#210`.

## 3. After the last issue — PRD close check

All four child issues closed by their PRs. Evaluate `#206`'s scope:

- **Delivered** → `gh issue close 206 --comment "Shipped via #211–#214. <summary>"`.
- **Gap remains** (e.g. PRD listed an Audit Log *UI* that no child covered) →
  leave `#206` open and report: "remaining: Audit Log viewing screen — file a
  follow-up issue."

## 4. Final report (terse)

| Issue | PR | Outcome |
| --- | --- | --- |
| #208 | #211 | Counter Price policy + admin multiplier |
| #207 | #212 | POS sells Single Cards (Retail) |
| #209 | #213 | Apply Counter at POS, Admin-gated |
| #210 | #214 | Audit Log (counter sale + multiplier) |

`npm test` → 469 passing · migrations deploy on merge: `counter_multiplier`,
`order_item_price_policy`, `audit_log` · PRD #206: closed.
