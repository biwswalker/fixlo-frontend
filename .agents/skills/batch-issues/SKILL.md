---
name: batch-issues
description: Implement a set of tracker issues end-to-end in dependency order — build each one via /implement, open a PR, review/fix until clean, wait for green CI, then squash-merge, and repeat. Use when the user wants to batch-implement multiple issues, work a PRD's child issues to completion, run an AFK/unattended implementation pass, or says "implement these issues", "do all the tickets", "go until done".
---

# Batch Issues

Drive a set of issues from open to merged, one at a time, in dependency order.
Built for unattended (AFK) runs: each issue goes implement → PR → review → fix →
merge before the next starts. Uses the [implement](../implement/SKILL.md) skill
to build — it runs TDD internally at pre-agreed seams, typechecks, runs the test
suite, and commits — and the `/code-review` skill for a PR-level review pass.
A full worked run is in [EXAMPLES.md](EXAMPLES.md).

Issue-tracker commands live in [docs/agents/issue-tracker.md](../../../docs/agents/issue-tracker.md) — this repo uses `gh`.

## Run quietly (token economy)

This skill runs AFK — minimise interaction and tokens. Batch independent tool
calls into one step. Keep status terse; no per-step narration. Prefer the
background CI watcher over polling in a loop. Ask the user **only** for a genuine
blocking decision — otherwise run to the end of the list and report once.

## Inputs

Accept any of: explicit issue numbers, a parent PRD issue (use its child
issues), or a label (e.g. `ready-for-agent`). Resolve to a concrete ordered
list before starting.

## Order by dependency

Read each issue body's **Blocked by** section. Start with unblocked issues;
an issue becomes eligible only once every blocker is merged. Within a tier,
any order is fine. Never start an issue whose blocker is still open.

## Per-issue loop

For each issue, in order:

1. **Branch.** From an up-to-date default branch: `git switch -c feat/<n>-<slug>`.
2. **Implement.** Run the [implement](../implement/SKILL.md) skill against the
   issue. It builds with TDD internally at pre-agreed seams, typechecks
   regularly, runs the full test suite, and commits (co-author trailer per repo
   rules) once done. Extract pure, testable modules. Use the project's domain
   glossary and respect ADRs.
3. **Schema changes** (if any): confirm the migration was written, the client
   regenerated, and the generated types validated as part of step 2's commit(s).
4. **Push + PR.** Push the branch and open a PR whose body has `Closes #<n>` and
   the issue's acceptance criteria ticked.
5. **Review + fix loop.** Review the diff (`/code-review`). Apply every confirmed
   finding, re-run the project's full checks (tests, lint, build/typecheck), push,
   and re-review. Repeat until a review pass is clean. Self-review small
   self-authored diffs; reserve heavy review for risky ones (money, auth,
   transactions, migrations).
6. **Wait for CI.** `gh pr checks <pr> --watch`. If a check is **cancelled** or
   flakes (not a real failure), re-run it (`gh run rerun <id> --failed`); fix and
   push for genuine failures.
7. **Merge.** Squash-merge and delete the branch once checks are green and review
   is clean. Then sync local: `git switch <default> && git fetch && git reset
   --hard origin/<default>`.
8. **Next.** The merge may unblock dependents — re-check eligibility and continue.

Track progress with the task list (one task per issue, blockers as `blockedBy`);
mark each completed only after its PR merges.

## Rules

- One issue in flight at a time; finish (merge) before starting the next.
- Branch first — never commit to the default branch. Merge only after gates +
  review + green CI.
- Do **not** modify or close the parent PRD issue; the child PRs close their own
  issues via `Closes #<n>`.
- Stop and surface a blocked decision only when it's genuinely the user's to make
  (see [implement](../implement/SKILL.md)); otherwise keep going to the end of the list.

## Close out the PRD

When every child issue is merged and the inputs came from (or trace to) a parent
PRD issue, decide whether the PRD is fully delivered:

- Evaluate the PRD's stated scope/acceptance against what shipped (the child
  issues are closed by their PRs).
- **Fully delivered** → close the PRD with a completion comment linking the
  merged PRs. (This is the one time it's right to touch the parent.)
- **Not yet** → leave it open and report exactly what remains: which scope items,
  out-of-scope/follow-up work, or new issues to file before it can close.

## Done

Report once, terse: a summary table (issue → PR → one-line outcome), total tests,
any migrations that deploy on merge, and the PRD close decision (closed, or the
gap that keeps it open).
