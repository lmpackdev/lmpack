# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-26

First release.

### Added

- `lmpack pack [path]` collects project files into one pack for a language
  model, written to stdout or `--out`.
- Selection by `--include` and `--exclude` globs, honoring `.gitignore`
  (including parent directories up to the repository root) and
  `.lmpackignore`.
- Token counting with `gpt-tokenizer`: `o200k` (default), `cl100k`, `p50k`,
  `r50k`.
- `--budget`: files are dropped by category priority, largest first, then
  dropped files are restored if they still fit. The final pack is re-counted,
  so it never exceeds the budget.
- Two pack formats: markdown (`--format md`, default) and xml
  (`--format xml`).
- Report to stderr or `--report`: packed files and tokens, top 10 files by
  tokens, every skipped file with its reason.
- `--dry-run` prints the report without writing the pack.
- `--git-diff <ref>` packs files changed since the merge base with `ref`,
  plus files in the same directories as a lower-priority category;
  `--no-neighbors` turns that off.
- `lmpack.json` config with profiles (`--profile`), `priority` and
  `categories`.
- Secret filter, on by default: `.env`, `.env.*`, `*.key`, `*.pem`, `*.p12`,
  `id_*`, `*secret*`, `*.kdbx`, and files containing PEM private keys or
  certificates. `--allow-secrets` turns it off. The report names the file and
  the rule, never the content.
- Skipped with a reason in the report: dependency lock files (unless named in
  `--include`), binary and non-UTF-8 files, empty files, files over
  `--max-file-size`, files with lines longer than `maxLineLength`, symlinks.
- UTF-8 byte-order marks are stripped, line endings normalized to LF, paths
  always use forward slashes.
- Exit codes: `0` pack written, `1` error, `2` pack written but some files
  were dropped to fit the budget.

[0.1.0]: https://github.com/lmpackdev/lmpack/releases/tag/v0.1.0
