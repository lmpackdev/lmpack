---
title: Recipes
description: Packing one package of a monorepo, reviewing a branch with --git-diff, and running lmpack in CI.
---

## Monorepo: one package

Point `lmpack` at the package directory:

```bash
npx lmpack pack packages/api --budget 100k --out api.md
```

- Paths in the pack are relative to `packages/api`.
- `lmpack.json` is read from `packages/api`, so each package can have its own.
- `.gitignore` files from the repository root down to `packages/api` still
  apply, so a root rule like `dist/` works inside the package.

## Monorepo: shared code first

To pack the whole repository but keep shared libraries when the budget is
tight, give them their own category and rank it first:

```json
{
  "categories": {
    "shared": ["packages/shared/**", "packages/types/**"],
    "api": ["packages/api/**"],
    "web": ["packages/web/**"]
  },
  "priority": ["shared", "api", "(root)", "web", "docs"]
}
```

Files that match none of the globs fall back to their top-level directory
(`packages`, `docs`, …). Categories missing from `priority` are dropped first.

## Review a branch

```bash
npx lmpack pack --git-diff main --out review.md
```

This selects:

- files changed since the branch point with `main` (the merge base), whether
  committed or not;
- new files that git does not ignore, even if not yet added;
- other files in the same directories as the changed ones ("neighbors"), so
  the model sees the context around a change.

Deleted files are not in the pack. Neighbors form their own category that
the budget drops before anything else, so with a tight budget the changed
files stay:

```bash
npx lmpack pack --git-diff main --budget 30k --out review.md
```

To pack only the changed files:

```bash
npx lmpack pack --git-diff main --no-neighbors
```

`--git-diff` accepts any ref git understands: a branch, a tag, `HEAD~3`, a
commit hash. The pack contains whole files, not diffs; send the output of
`git diff` alongside it if the model should see what exactly changed.

## CI: attach a pack to a pull request

A GitHub Actions job that builds a pack of the changed files and uploads it as
an artifact:

```yaml
name: llm-pack
on: pull_request

jobs:
  pack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # --git-diff needs the base branch history
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx lmpack pack --git-diff origin/${{ github.base_ref }} --budget 100k --out pack.md --report report.txt || [ $? -eq 2 ]
      - uses: actions/upload-artifact@v4
        with:
          name: llm-pack
          path: |
            pack.md
            report.txt
```

`|| [ $? -eq 2 ]` lets the step pass when files were dropped for the budget
(exit code `2`) and still fails on real errors (exit code `1`).

## CI: check that a profile still fits

To be told when a profile outgrows its budget, fail the job on exit code `2`:

```yaml
      - run: npx lmpack pack --profile backend --dry-run
```

Any non-zero exit code fails the step, so this job goes red as soon as the
`backend` selection needs more tokens than its budget.
