---
title: Profiles
description: Save a selection in lmpack.json and rebuild the same pack later.
---

A profile is a named set of settings in `lmpack.json`. It turns a long command
line into a name, and it keeps the selection the same between runs.

```json
{
  "budget": "120k",
  "exclude": ["**/*.snap"],
  "profiles": {
    "backend": {
      "include": ["src/server/**", "migrations/**", "package.json"],
      "budget": "80k"
    },
    "frontend": {
      "include": ["src/web/**", "public/*.html"],
      "exclude": ["**/*.stories.tsx", "**/*.snap"],
      "format": "xml"
    },
    "docs": {
      "include": ["docs/**", "README.md"],
      "priority": ["(root)", "docs"]
    }
  }
}
```

```bash
npx lmpack pack --profile backend --out backend.md
npx lmpack pack --profile frontend --dry-run
```

## What a profile can hold

Any top-level key except `profiles`: `include`, `exclude`, `budget`,
`tokenizer`, `format`, `maxFileSize`, `maxLineLength`, `priority`,
`categories`.

## How it merges

A profile key replaces the top-level key of the same name. Arrays are not
merged: in the example above, `frontend` repeats `**/*.snap` because its own
`exclude` replaces the top-level one.

Flags on the command line win over the profile:

```bash
# backend profile, but with a smaller budget
npx lmpack pack --profile backend --budget 40k
```

## Repeatable results

The same files, config and `lmpack` version give the same pack. Files are
ordered by path, and the budget always drops in the same order. Commit
`lmpack.json` with the project so everyone gets the same selection.

The pack changes when the files change, of course. To see what a profile
selects before sending anything, run it with `--dry-run`.
