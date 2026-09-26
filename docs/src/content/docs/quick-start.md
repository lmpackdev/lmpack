---
title: Quick start
description: Pack a project, read the report, and fit a token budget.
---

## 1. See what would be packed

From the project root:

```bash
npx lmpack pack --dry-run
```

`--dry-run` prints the report to stdout and writes nothing. For the lmpack
repository itself the report looks like this (shortened):

```
lmpack 0.1.0 report (dry run, pack not written)

  root       C:/Users/me/Code/lmpack
  tokenizer  o200k
  format     md
  budget     none

Packed: 54 files, 33,949 tokens

Top 10 files by tokens:
  1,907  src/config.ts
  1,628  src/walk.ts
  1,587  README.md
  ...

Skipped: 8
  ignored   dist/                   .gitignore
  ignored   docs/node_modules/      .gitignore
  ignored   node_modules/           .gitignore
  ...
  lockfile  package-lock.json       pass --include to pack it
```

Everything under **Skipped** stayed out of the pack, with the reason on the
right. The file contents never appear in the report.

## 2. Write the pack

```bash
npx lmpack pack --out pack.md
```

The pack goes to `pack.md`, the report to stderr. Without `--out` the pack goes
to stdout, so it can be piped:

```bash
npx lmpack pack | clip        # Windows
npx lmpack pack | pbcopy      # macOS
```

## 3. Fit a budget

```bash
npx lmpack pack --budget 20k --out pack.md
```

If everything fits, the exit code is `0`. If some files had to go, the exit
code is `2` and the report lists them:

```
Packed: 37 files, 19,859 tokens (99% of budget)
...
Dropped by budget: 17 files, 14,013 tokens freed:
  1,236  docs/src/content/docs/index.mdx  (category docs)
  1,175  docs/src/content/docs/reference/cli.md  (category docs)
  ...
  1,496  tests/cli.test.ts  (category tests)
  ...
```

Which files go first is explained in [Budget](/guides/budget/).

## 4. Narrow the selection

```bash
npx lmpack pack src --include "*.ts" --exclude "*.test.ts"
```

A glob without a slash matches the file name at any depth; a glob with a slash
matches the path from the pack root. See the [CLI reference](/reference/cli/#globs).

## 5. Save the selection

Put the flags into `lmpack.json` so the same pack can be built again:

```json
{
  "budget": "120k",
  "profiles": {
    "backend": { "include": ["src/**", "migrations/**"], "budget": "80k" }
  }
}
```

```bash
npx lmpack pack --profile backend --out backend.md
```

See [Profiles](/guides/profiles/) and [Configuration](/reference/configuration/).
