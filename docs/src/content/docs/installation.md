---
title: Installation
description: Run lmpack with npx or install it globally or per project.
---

`lmpack` needs Node.js 22.12 or later. Check with `node --version`.

## Run without installing

```bash
npx lmpack pack --dry-run
```

`npx` downloads the package on first use and caches it.

## Install globally

```bash
npm install --global lmpack
lmpack --version
```

## Install in a project

Useful when a project pins the version or runs `lmpack` in CI.

```bash
npm install --save-dev lmpack
```

Then call it from a script in `package.json`:

```json
{
  "scripts": {
    "pack:llm": "lmpack pack --profile backend --out pack.md"
  }
}
```

## Git

`--git-diff` runs the local `git` executable. Everything else works without
git, including `.gitignore` handling.

## Network

`lmpack` makes no network requests. Tokenizers ship inside the package, there
is no telemetry and no update check.
