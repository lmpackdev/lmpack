# lmpack

Pack a project into one file for a language model. `lmpack` walks the tree,
selects files by masks and `.gitignore`, counts tokens with a real tokenizer,
fits the result into a token budget, and prints a report of what was left out
and why.

Documentation: [lmpack.org](https://lmpack.org)

```bash
npx lmpack pack --budget 120k --out pack.md
```

- **Token budget.** Files are dropped by category priority, largest first,
  until the pack fits. Exit code `2` tells scripts that something was dropped.
- **Report.** Packed files, top 10 by tokens, and every skipped file with a
  reason: budget, size, binary, secret, ignored, symlink, and so on.
- **Git mode.** `--git-diff main` packs only what changed, plus files in the
  same directories.
- **Secret filter on by default.** `.env`, `*.pem`, `*.key`, `id_*`,
  `*secret*`, PEM private keys and certificates never reach the pack unless you
  pass `--allow-secrets`.
- **Offline.** No network access, no telemetry.

Requires Node.js 22.12 or later.

## Quick start

```bash
# Everything that fits into 120k tokens, markdown to a file
npx lmpack pack --budget 120k --out pack.md

# What would be packed, without writing the pack
npx lmpack pack --dry-run

# Only TypeScript sources, without tests, as XML
npx lmpack pack src --include "*.ts" --exclude "*.test.ts" --format xml

# Changes since main, for a review
npx lmpack pack --git-diff main --out changes.md
```

The pack goes to stdout (or `--out`), the report to stderr (or `--report`).
With `--dry-run` the report goes to stdout and the pack is not written.

Example report:

```
lmpack 0.1.0 report

  root       C:/work/app
  tokenizer  o200k
  format     md
  budget     20,000 tokens

Packed: 32 files, 19,267 tokens (96% of budget)

Top 10 files by tokens:
  2,050  README.md
  1,907  src/config.ts
  ...

Dropped by budget: 2 files, 33,851 tokens freed:
   1,302  tests/budget.test.ts  (category tests)
  32,549  package-lock.json  (category (root))

Skipped: 3
  secret   .env           name matches .env
  ignored  dist/          .gitignore
  ignored  node_modules/  .gitignore
```

## Options

| Option | Meaning |
|---|---|
| `--include <glob>` | Only pack matching files; repeatable. Default: everything |
| `--exclude <glob>` | Skip matching files; repeatable |
| `--budget <n>` | Token budget: `120000` or `120k`. Default: no limit |
| `--profile <name>` | Use a profile from `lmpack.json` |
| `--format md\|xml` | Pack format. Default: `md` |
| `--out <file>` | Write the pack to a file. Default: stdout |
| `--git-diff <ref>` | Only files changed since `ref`, plus their directory neighbors |
| `--no-neighbors` | With `--git-diff`: changed files only |
| `--tokenizer <name>` | `o200k` (default), `cl100k`, `p50k`, `r50k` |
| `--max-file-size <n>` | Skip larger files. Default: `256kb` |
| `--allow-secrets` | Turn off the secret filter |
| `--dry-run` | Report only, do not write the pack |
| `--report <file>` | Write the report to a file. Default: stderr |

A glob without a slash (`*.ts`) matches the file name at any depth; a glob with
a slash (`src/**`) matches the path from the pack root.

Exit codes: `0` pack written, `1` error, `2` pack written but some files were
dropped to fit the budget.

## Configuration

`lmpack.json` in the pack root. Command-line flags override a profile, a
profile overrides the top level.

```json
{
  "tokenizer": "o200k",
  "budget": "120k",
  "maxFileSize": "256kb",
  "maxLineLength": 1000,
  "priority": ["core", "src", "tests", "docs"],
  "categories": {
    "core": ["src/core/**"]
  },
  "profiles": {
    "backend": {
      "include": ["src/**", "migrations/**"],
      "exclude": ["**/*.snap"],
      "budget": "80k"
    }
  }
}
```

`priority` lists categories from most to least important; the budget drops
files from the end of the list first. A file belongs to the first category in
`categories` whose glob matches; otherwise its category is its top-level
directory, and files in the root are `(root)`. Categories missing from
`priority` are dropped before listed ones. Default priority: `src`, `lib`,
`app`, `packages`, `(root)`, `tests`, `test`, `docs`.

After dropping, `lmpack` puts back dropped files, most important first, if they
still fit. One huge lockfile does not take a whole category of small files
with it.

## What is skipped

- Anything matched by `.gitignore` (including those in parent directories up
  to the repository root) or `.lmpackignore`; `node_modules/` and VCS
  directories always.
- Dependency lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`,
  `Cargo.lock`, `poetry.lock`, `go.sum` and others): machine-generated and
  large, while the manifest next to them already lists the dependencies. Name
  one in `--include` to pack it.
- Symlinks: reported, never followed.
- Binary files (NUL bytes or invalid UTF-8 in the first 8 KB), other
  non-UTF-8 text, UTF-16 files.
- Empty files, files over `--max-file-size`, files with a line longer than
  `maxLineLength` (minified bundles).
- Likely secrets, by name (`.env`, `.env.*`, `*.key`, `*.pem`, `*.p12`, `id_*`,
  `*secret*`, `*.kdbx`) or by content (PEM private key or certificate armor).
  The report names the file and the rule, never the content.

A UTF-8 byte-order mark is stripped and noted in the report. Line endings are
normalized to LF. Paths in the pack always use forward slashes.

## Library

```ts
import { packProject, renderReport, exitCodeFor } from 'lmpack';

const result = await packProject({ path: '.', budget: '120k' });
console.log(result.output);
console.error(renderReport(result));
```

## License

MIT
