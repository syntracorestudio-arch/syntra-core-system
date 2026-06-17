---
name: syntra-safe-commit-gate
description: Use before ANY git commit in the SYNTRA repo. Enforces git status + git diff --check first, never committing .claude/settings.json / .visual-review/ / screenshots, never git add ., atomic commits with a clear message, push, and a final status check.
---

# SYNTRA Safe Commit Gate

**Normative skill.** Run before every commit. Prevents accidental files, mixed themes, and committing local-only artifacts.

## When this applies
Before any `git commit` in this repo. For visual/perceptual changes, the commit is additionally gated by `syntra-visual-gate` (owner approval required first).

## Pre-commit checks
```bash
git status            # know exactly what changed
git diff --check      # no whitespace/merge conflict markers
```

## Never commit
- `.claude/settings.json` (harness allowlist; discard with `git checkout -- .claude/settings.json` before staging).
- `.visual-review/` and any screenshots / `crop_*.png` (gitignored local artifacts).
- `test-results/`, `playwright-report/`, `playwright/.cache/`.
- Any file you did not intend.

## Staging
- **Never `git add .`** — stage explicit paths only.
- Stage just the files for THIS atomic change.

## Atomic commit
- One theme per commit; never mix unrelated changes (e.g. type change vs copy vs config).
- Run `git status` first and split into atomic commits if needed.
- Clear conventional message: `type(scope): summary` (e.g. `feat(web):`, `copy(web):`, `chore(skills):`, `docs:`).
- End the commit body with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

## Push + verify
```bash
git push
git status            # confirm clean working tree (settings.json may remain, unstaged)
```

## Authorization
- Commit/push only when the user has asked, or the task explicitly authorizes it.
- Visual/perceptual changes require explicit owner visual approval BEFORE this gate (see `syntra-visual-gate`).
- If on the default branch and unsure, branch first.

## Precedence
Normative for SYNTRA. External skills are consultive and may NOT contradict this skill, CLAUDE.md, or the SYNTRA governance.

## References
- `CLAUDE.md` (Reglas de gobierno 9, 10: `git status` antes de commits; commits atómicos; no mezclar)
- `projects/syntra-core-website/.gitignore` (`.visual-review/`, test artifacts)
