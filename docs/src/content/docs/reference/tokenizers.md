---
title: Tokenizers
description: Which tokenizers lmpack supports and how accurate its counts are for different models.
---

`lmpack` counts tokens, not characters. The same number of characters costs a
very different number of tokens in code and in prose, and model limits are
set in tokens.

Counting uses [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer), a
JavaScript port of OpenAI's `tiktoken` encodings. It runs locally; nothing is
sent anywhere.

| Name | Encoding | Used by |
|---|---|---|
| `o200k` (default) | `o200k_base` | GPT-4o, GPT-4.1, GPT-5, o-series |
| `cl100k` | `cl100k_base` | GPT-4, GPT-3.5-turbo |
| `p50k` | `p50k_base` | Codex, text-davinci-002/003 |
| `r50k` | `r50k_base` | GPT-3 |

Pick one with `--tokenizer cl100k` or `"tokenizer": "cl100k"` in
`lmpack.json`. The full encoding name (`cl100k_base`) works too.

## What is counted

The budget covers the whole pack: the directory tree, file headings, code
fences or XML tags, and the file contents. After the pack is rendered it is
counted again as a whole, and the number in the report is that final count.

Special-token strings such as `<|endoftext|>` inside your files are counted as
ordinary text.

## Accuracy for other models

For OpenAI models the count matches what the model sees for the pack text.
The chat wrapper around your message adds a few tokens that `lmpack` does not
know about.

Claude, Gemini, Llama, Mistral and other model families use their own
tokenizers, and those are not public in a form `lmpack` can run offline. For
them the count is an estimate. We have not measured the difference, and it
varies with the language and the kind of code. Leave a margin: set the budget
below the model's limit, and leave room for your question and the answer.
