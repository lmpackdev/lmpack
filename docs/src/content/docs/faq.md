---
title: FAQ
description: Common questions about lmpack.
---

## Why is my file not in the pack?

Run with `--dry-run` and look for its path in the report. Every file that was
looked at and left out has a line with the reason. If the file is not
mentioned at all, it did not match `--include`, matched `--exclude`, or is
inside an ignored directory; the summary line at the end counts files not
selected by globs or git.

## Why are lock files skipped?

`package-lock.json`, `yarn.lock`, `Cargo.lock` and the like are generated,
large and rarely useful to a model: in this repository `package-lock.json`
alone was 32,549 tokens, two thirds of the whole pack. The manifest next to
the lock file already lists the dependencies. To pack one anyway, name it:

```bash
npx lmpack pack --include package-lock.json --include "src/**"
```

## Why was a text file reported as binary?

A file counts as binary when its first 8 KB contain a NUL byte, or when it is
not valid UTF-8 and has many control bytes. Text in a legacy encoding such as
Windows-1251 or Latin-1 is reported as `non-utf8`. Convert it to UTF-8 to pack
it.

## What happens to UTF-8 files with a byte-order mark?

The mark is removed, the file is packed, and the report has a note. UTF-16 and
UTF-32 files are skipped as `non-utf8`.

## Why was a minified file skipped?

Files with a line longer than `maxLineLength` (1,000 characters by default)
are skipped as `long-line`: minified bundles and generated data are expensive
in tokens and useless to read. Raise the limit in `lmpack.json` if you need
such a file.

## Does lmpack follow symlinks?

No. Symlinks and Windows junctions are listed in the report and not followed,
so a link loop cannot hang the walk and a link cannot pull in files from
outside the project.

## Are line endings changed?

Yes. CRLF and CR are converted to LF in the pack. The files on disk are not
touched.

## Can I use lmpack from code?

Yes:

```ts
import { packProject, renderReport, exitCodeFor } from 'lmpack';

const result = await packProject({ path: '.', budget: '120k' });
console.log(result.output);        // the pack
console.error(renderReport(result));
process.exitCode = exitCodeFor(result);
```

`result.files` and `result.skipped` hold the same data as the report.

## Does lmpack send anything over the network?

No. There is no telemetry and no update check, and the tokenizers are bundled.
The only external program it runs is `git`, and only with `--git-diff`.

## Which model should I pick the tokenizer for?

`o200k` fits current OpenAI models. For other model families the count is an
estimate; see [Tokenizers](/reference/tokenizers/).
