---
title: Budget
description: How lmpack decides which files to drop when the pack does not fit the token budget.
---

With `--budget` (or `"budget"` in `lmpack.json`) the pack never exceeds the
given number of tokens. When everything fits, nothing changes. When it does
not, `lmpack` drops whole files, never parts of a file, and lists each dropped
file in the report.

## The order

1. **Categories from the end of `priority`.** Each file has a category: the
   first match in `categories`, otherwise its top-level directory, or
   `(root)` for files in the pack root. Categories missing from `priority`
   go before listed ones. With `--git-diff`, the neighbor files go first of
   all. See [Configuration](/reference/configuration/#categories-and-priority).
2. **Largest first within a category.** One big file frees more room than
   many small ones and costs the model less context per dropped file.
3. **Put back what still fits.** After enough files are dropped, `lmpack`
   walks the dropped list back from the most important file and restores each
   one that still fits. Without this step, one huge file in an important
   category would push out every smaller file in the less important ones.
4. **Re-count.** Tokens do not add up exactly across file boundaries, so the
   rendered pack is counted again as a whole. If it is still over, the next
   file in the order is dropped and the pack is counted again.

The directory tree at the top of the pack shows only the files that made it
in.

## Example

The lmpack repository itself (34k tokens) with the default priority (`src`,
`lib`, `app`, `packages`, `(root)`, `tests`, `test`, `docs`) and
`--budget 20k`:

```
Packed: 37 files, 19,859 tokens (99% of budget)

Dropped by budget: 17 files, 14,013 tokens freed:
  1,236  docs/src/content/docs/index.mdx  (category docs)
  1,175  docs/src/content/docs/reference/cli.md  (category docs)
    892  docs/src/content/docs/reference/configuration.md  (category docs)
  ...
    123  docs/package.json  (category docs)
  1,496  tests/cli.test.ts  (category tests)
  1,465  tests/select.test.ts  (category tests)
  1,302  tests/budget.test.ts  (category tests)
  1,072  tests/content.test.ts  (category tests)
```

`docs` is last in the priority, so its files went first, largest first. That
was not enough, so the four largest files of `tests`, the next category up,
followed. Then the step that puts files back returned the three smallest
`docs` files (48 to 76 tokens each), which fit into the room left. All
sources, the root files and five smaller tests stayed. The report shows the
tokens each dropped file would have cost.

## Exit code

When at least one file is dropped for the budget, `lmpack` still writes the
pack and exits with code `2`. Scripts can treat that as a warning:

```bash
npx lmpack pack --budget 100k --out pack.md
if [ $? -eq 2 ]; then echo "pack is incomplete, see the report"; fi
```

## When even an empty pack does not fit

The pack has a small fixed frame: a heading and the tree in markdown, the
wrapper tags in XML. A budget smaller than that cannot be met. `lmpack` then
drops every file, writes the frame, prints a warning in the report and exits
with `2`.

## Choosing a budget

Take the model's context window, subtract room for your question, the
system prompt and the answer, and pack into what remains. If the model is not
an OpenAI one, leave extra margin; see [Tokenizers](/reference/tokenizers/#accuracy-for-other-models).
