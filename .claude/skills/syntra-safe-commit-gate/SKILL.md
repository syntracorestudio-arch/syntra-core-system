---
name: syntra-safe-commit-gate
description: Use before ANY git commit in the SYNTRA repo. Enforces git status + git diff --check first, never committing .claude/settings.json / .visual-review/ / screenshots, never git add ., atomic commits with a clear message, push, and a final status check.
---

# SYNTRA Safe Commit Gate

**Normative skill.** Run before every commit. Prevents accidental files, mixed themes, and committing local-only artifacts.

## Copyable checklist (copy this into your response and tick each item)

```
- [ ] git status + git diff --check (know exactly what changed; no conflict markers)
- [ ] Visual/perceptual change? → owner approved the LIVE prototype first (syntra-visual-gate)
- [ ] Staging explícito SOLO de los archivos de ESTE tema (nunca add . / -A / commit -a)
- [ ] Sin prohibidos staged: .claude/settings.json · .visual-review/ · screenshots · tools/ · *.glb/*.blend
- [ ] Deps staged (package.json/lock)? SOLO con aprobación explícita del owner
- [ ] Mensaje `type(scope): summary` + Co-Authored-By
- [ ] git push -u origin <branch> (NUNCA main)
- [ ] git status final: working tree limpio salvo locales esperados (settings.json puede quedar M, sin stagear)
- [ ] PR abierto (Autopilot) — el merge es SIEMPRE manual del owner
- [ ] **DESPUÉS DEL MERGE**: `git fetch` + `git cherry origin/main <branch>` = vacío. Si no, hay commits huérfanos → NUEVO PR (el mergeado no se reabre)
```

**STOP gates (hard):**
- If any check fails → **STOP**: fix it or report the failing step with its output. Do NOT work around the failure (no `--no-verify`, no alternate tools to bypass a hook deny). Repeat the check until PASS.
- If a hook blocks the command, the block message contains the exact correct path — follow it, don't fight it.
- If you are about to stage a file you did not modify in THIS task → STOP and split the commit.

## When this applies
Before any `git commit` in this repo. For visual/perceptual changes, the commit is additionally gated by `syntra-visual-gate` (owner approval required first).

## Pre-commit checks
```bash
git status            # know exactly what changed
git diff --check      # no whitespace/merge conflict markers
```

## Never commit (enforced by the active git hook `guard-forbidden-commit.mjs`)
- `.claude/settings.json` (harness allowlist; discard with `git checkout -- .claude/settings.json` before staging).
- `.visual-review/` and any screenshots / `crop_*.png` (gitignored local artifacts).
- `tools/`, `*.glb`, `*.blend`, `docs/reference-locks/assets/hero-stratos-3d*` (3D-spike artifacts; hard-blocked by the hook).
- `package.json` / `package-lock.json` → the hook WARNS (not blocks); only stage with explicit owner approval.
- `test-results/`, `playwright-report/`, `playwright/.cache/` (gitignored).
- Any file you did not intend.

## Staging
- **Never `git add .` / `-A` / `--all`** — blocked by the hook `guard-git-add.mjs`. Stage explicit paths only.
- **Never `git commit -a` / `-am` / `--all`** — blocked by `guard-forbidden-commit.mjs` (would drag tracked-modified files like settings.json). `--amend` is allowed.
- Stage just the files for THIS atomic change.

## Atomic commit
- One theme per commit; never mix unrelated changes (e.g. type change vs copy vs config).
- Run `git status` first and split into atomic commits if needed.
- Clear conventional message: `type(scope): summary` (e.g. `feat(web):`, `copy(web):`, `chore(skills):`, `docs:`).
- End the commit body with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

## Verificación POST-MERGE — "mergeado" ≠ "aterrizó"

Un PR puede mergearse con **parte** de su rama: si llegan commits después de que
el owner mergeó, quedan huérfanos en una rama cuyo PR ya está cerrado, y nadie
se entera porque el PR dice *merged*.

Pasó de verdad (2026-08-14, PR #229): se mergeó con **1 de 4 commits**. Los
otros tres incluían una migración de datos que el owner había pedido hacer *en
ese momento y no después* — quedó marcada como hecha sin estarlo. Y no fue la
primera: `perf/contacto-jank` arrastra desde el 2026-07-24 un commit fuera de
main con el PR #163 ya mergeado.

**Después de cada merge, verificar:**

```bash
git fetch origin main
git cherry origin/main <branch>    # vacío = todo aterrizó
```

Si sale algo: **abrir un PR nuevo**. Un PR mergeado no se reabre para eso, y
pushear a esa rama sólo agranda el huérfano.

> **Por qué no alcanza preguntarle a GitHub.** `gh pr view N --json commits`
> devuelve los commits **como quedaron al mergear**: no puede mostrar lo que se
> empujó después, así que una auditoría basada en eso reporta "sin huérfanos"
> siempre. Es un detector al que el propio caso que busca lo apaga. La
> comparación tiene que ser contra el **tip de la rama** (`origin/<branch>`).
>
> Corolario útil: si la rama se borró tras el merge, no puede haber huérfanos
> —no hay dónde vivan—. El riesgo existe **sólo en ramas que siguen vivas**, y
> ésas son pocas y enumerables.

## Push + verify
```bash
git push -u origin <branch>   # never push to main
git status                    # confirm clean working tree (settings.json may remain, unstaged)
```

## Open PR (Autopilot — owner merges manually)
`gh` is installed but NOT on PATH → call by full path. Claude may open PRs automatically:
```bash
"/c/Program Files/GitHub CLI/gh.exe" pr create --base main --head <branch> --title "…" --body "…"
```
The **owner merges manually**. See `agents/governance/SYNTRA-CONTEXT-ROUTER.md` §6.

## Authorization
- Commit/push only when the user has asked, or the task explicitly authorizes it.
- Visual/perceptual changes require explicit owner visual approval BEFORE this gate (see `syntra-visual-gate`).
- If on the default branch and unsure, branch first.

## Precedence
Normative for SYNTRA. External skills are consultive and may NOT contradict this skill, CLAUDE.md, or the SYNTRA governance.

## References
- `CLAUDE.md` (Reglas de gobierno 9, 10: `git status` antes de commits; commits atómicos; no mezclar)
- `projects/syntra-core-website/.gitignore` (`.visual-review/`, test artifacts)
