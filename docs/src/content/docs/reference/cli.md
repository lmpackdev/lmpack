---
title: CLI reference
description: Every lmpack flag, its default, exit codes and glob rules.
---

```
lmpack pack [path] [options]
```

`path` is the directory to pack, `.` by default. `lmpack.json` is read from
that directory. Relative `--out` and `--report` paths are resolved from the
current directory.

`lmpack` without a command prints help. `lmpack --version` prints the version.

## Options

| Option | Default | Meaning |
|---|---|---|
| `-i, --include <glob>` | everything | Only pack files matching the glob. Repeatable. |
| `-e, --exclude <glob>` | none | Skip files matching the glob. Repeatable. |
| `-b, --budget <tokens>` | no limit | Token budget: `120000`, `120k`, `1.5m`. |
| `-p, --profile <name>` | none | Use a profile from `lmpack.json`. |
| `-f, --format <format>` | `md` | Pack format: `md` or `xml`. |
| `-o, --out <file>` | stdout | Write the pack to a file. Parent directories are created. |
| `--git-diff <ref>` | off | Only files changed relative to a git ref, plus files in the same directories. |
| `--no-neighbors` | neighbors on | With `--git-diff`: changed files only. |
| `-t, --tokenizer <name>` | `o200k` | `o200k`, `cl100k`, `p50k`, `r50k`. See [Tokenizers](/reference/tokenizers/). |
| `--max-file-size <size>` | `256kb` | Skip larger files: `262144`, `256kb`, `1mb`. |
| `--allow-secrets` | off | Turn off the [secret filter](/guides/security-filter/). |
| `-n, --dry-run` | off | Print the report only; do not write the pack. |
| `-r, --report <file>` | stderr | Write the report to a file. |
| `-h, --help` | | Show help. |

Units: `k` is 1,000 and `m` is 1,000,000 for tokens; `kb` is 1,024 bytes and
`mb` is 1,024 × 1,024 for sizes.

## Where output goes

| Situation | Pack | Report |
|---|---|---|
| default | stdout | stderr |
| `--out pack.md` | `pack.md` | stderr |
| `--report r.txt` | stdout or `--out` | `r.txt` |
| `--dry-run` | not written | stdout |
| `--dry-run --report r.txt` | not written | `r.txt` |

`--dry-run` suppresses only the pack. An explicit `--report` is still written.

The files named by `--out` and `--report` are never packed themselves, even
when they sit inside the pack root.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Pack written; everything selected fit. |
| `1` | Error: bad flag or config, missing profile, `path` is not a directory, git ref not found. |
| `2` | Pack written, but some files were dropped to fit `--budget`. Also returned with `--dry-run`. |

## Globs

`--include`, `--exclude` and the globs in `lmpack.json` use the same rules:

- A glob **without a slash** matches the file name at any depth: `*.ts`
  matches `index.ts` and `src/deep/util.ts`.
- A glob **with a slash** matches the path from the pack root: `src/**`,
  `docs/*.md`, `**/*.snap`.
- Dotfiles match like any other file.
- Paths always use forward slashes, on Windows too.

`--exclude` wins over `--include`. With both empty, every file that survives
`.gitignore` and the automatic checks is packed.

## Precedence

Command-line flags override the selected profile, which overrides the top
level of `lmpack.json`, which overrides the defaults. `--include` and
`--exclude` given on the command line replace the lists from the config; they
are not merged. See [Configuration](/reference/configuration/).

## Selection order

For every file under `path`:

1. `.gitignore`, `.lmpackignore` and built-in ignores. Ignored directories are
   not entered and appear in the report as one line.
2. Symlinks are reported and not followed.
3. `--include`, `--exclude`, then lock files (unless `--include` matched them).
4. `--git-diff`, if given.
5. Secret filter by file name.
6. Size limit, then content checks: empty, binary, non-UTF-8, long lines.
7. Secret filter by content.
8. Token count, then the budget.

Files dropped in steps 1–2 and 5–8 are listed in the report with a reason.
Files not selected by globs or git are only counted in a summary line.
