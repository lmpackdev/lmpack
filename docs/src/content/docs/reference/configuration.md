---
title: Configuration
description: The lmpack.json file, every key, and how it merges with flags.
---

`lmpack` reads `lmpack.json` from the pack root (the `path` argument, `.` by
default). The file is optional.

```json
{
  "tokenizer": "o200k",
  "budget": "120k",
  "format": "md",
  "maxFileSize": "256kb",
  "maxLineLength": 1000,
  "include": [],
  "exclude": ["**/*.snap"],
  "priority": ["core", "src", "tests", "docs"],
  "categories": {
    "core": ["src/core/**"]
  },
  "profiles": {
    "backend": {
      "include": ["src/**", "migrations/**"],
      "budget": "80k"
    }
  }
}
```

## Keys

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tokenizer` | string | `"o200k"` | See [Tokenizers](/reference/tokenizers/). |
| `budget` | string or number | none | Token budget, `"120k"` or `120000`. |
| `format` | `"md"` or `"xml"` | `"md"` | Pack format. |
| `maxFileSize` | string or number | `"256kb"` | Skip files larger than this. |
| `maxLineLength` | number | `1000` | Skip files with a longer line (minified code). No CLI flag. |
| `include` | string[] | `[]` (everything) | Globs of files to pack. |
| `exclude` | string[] | `[]` | Globs of files to skip. |
| `priority` | string[] | see below | Categories from most to least important. |
| `categories` | object | `{}` | Category name → list of globs. |
| `profiles` | object | `{}` | Profile name → any of the keys above except `profiles`. |

Unknown keys are an error, so a typo such as `"tokenzier"` does not pass
silently. A UTF-8 byte-order mark at the start of the file is allowed.

## Merging

1. Built-in defaults.
2. Top level of `lmpack.json`.
3. The profile named by `--profile`.
4. Command-line flags.

Each level replaces the previous one key by key. Arrays are replaced whole:
a profile's `exclude` does not add to the top-level `exclude`, it takes its
place. The same holds for `--include`/`--exclude` on the command line.

A missing profile is an error that lists the available names.

## Categories and priority

Every packed file belongs to one category. The budget uses categories to
decide what to drop; see [Budget](/guides/budget/).

- A file belongs to the first entry in `categories` whose globs match it. The
  order of keys in the JSON object matters.
- Otherwise the category is the top-level directory: `src/a/b.ts` is in `src`.
- Files in the pack root are in `(root)`.

`priority` lists categories from most to least important. The default is:

```json
["src", "lib", "app", "packages", "(root)", "tests", "test", "docs"]
```

Categories not listed in `priority` rank below all listed ones. When you set
`priority`, it replaces the default completely, so add `"(root)"` if the root
files matter to you.

## Ignore files

These are not keys in `lmpack.json`, but they shape the selection:

- `.gitignore` in the pack root and every subdirectory, plus `.gitignore`
  files in parent directories up to the root of the git repository.
- `.lmpackignore`, same syntax, for files that git should track but the model
  does not need to see.
- `node_modules/` is always skipped; `.git`, `.hg` and `.svn` are skipped
  silently.
