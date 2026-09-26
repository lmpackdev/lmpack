#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
import { CONFIG_FILE } from './config.js';
import { EXIT_ERROR, exitCodeFor } from './exit.js';
import { packProject } from './pack.js';
import { renderReport } from './report.js';
import { TOKENIZERS } from './tokenize.js';
import { VERSION } from './version.js';

const collect = (value: string, prev: string[] | undefined) => [...(prev ?? []), value];

const program = new Command()
  .name('lmpack')
  .description(
    'Pack project files into one file for a language model, fit it into a token budget,\n' +
      'and report what was left out and why.',
  )
  .version(VERSION, '-v, --version')
  .helpCommand(false)
  .showHelpAfterError('(run with --help for usage)')
  .addHelpText(
    'after',
    `
Run "lmpack pack --help" for all options.

Examples:
  lmpack pack --budget 120k --out pack.md   pack the current project into 120k tokens
  lmpack pack --git-diff main               only files changed since main
  lmpack pack --dry-run                     show what would be packed`,
  );

program
  .command('pack')
  .description('Collect files under [path] into a single pack (markdown or xml).')
  .argument('[path]', 'project root to pack', '.')
  .option('-i, --include <glob>', 'only pack files matching glob; repeatable (default: everything)', collect)
  .option('-e, --exclude <glob>', 'skip files matching glob; repeatable', collect)
  .option('-b, --budget <tokens>', 'token budget, e.g. 120000 or 120k (default: no limit)')
  .option('-p, --profile <name>', `use a profile from ${CONFIG_FILE}`)
  .addOption(new Option('-f, --format <format>', 'pack format').choices(['md', 'xml']))
  .option('-o, --out <file>', 'write the pack to a file (default: stdout)')
  .option('--git-diff <ref>', 'only files changed relative to a git ref, plus files in the same directories')
  .option('--no-neighbors', 'with --git-diff: do not add files from the same directories')
  .addOption(
    new Option('-t, --tokenizer <name>', 'tokenizer used for counting (default: o200k)').choices(
      Object.keys(TOKENIZERS),
    ),
  )
  .option('--max-file-size <size>', 'skip files larger than this, e.g. 256kb, 1mb (default: 256kb)')
  .option('--allow-secrets', 'turn off the secret filter (.env, *.pem, private keys, ...)')
  .option('-n, --dry-run', 'print the report only; do not write the pack')
  .option('-r, --report <file>', 'write the report to a file (default: stderr; stdout with --dry-run)')
  .addHelpText(
    'after',
    `
Files are selected from [path], honoring .gitignore and .lmpackignore.
Skipped automatically: binary and non-UTF-8 files, empty files, files over
--max-file-size, minified files with very long lines, symlinks, and likely
secrets. Everything skipped is listed in the report with a reason.

Settings are read from ${CONFIG_FILE} in [path]; command-line flags win.

Exit codes:
  0  pack written
  1  error
  2  pack written, but some files were dropped to fit --budget

Examples:
  lmpack pack --budget 120k --out pack.md
  lmpack pack src --include "*.ts" --exclude "**/*.test.ts"
  lmpack pack --git-diff main --format xml --out changes.xml
  lmpack pack --profile backend --dry-run`,
  )
  .action(async (root: string, flags: Record<string, unknown>) => {
    const result = await packProject({
      path: root,
      include: flags.include as string[] | undefined,
      exclude: flags.exclude as string[] | undefined,
      budget: flags.budget as string | undefined,
      profile: flags.profile as string | undefined,
      format: flags.format as string | undefined,
      out: flags.out as string | undefined,
      report: flags.report as string | undefined,
      gitDiff: flags.gitDiff as string | undefined,
      neighbors: flags.neighbors as boolean,
      tokenizer: flags.tokenizer as string | undefined,
      maxFileSize: flags.maxFileSize as string | undefined,
      allowSecrets: flags.allowSecrets === true,
      dryRun: flags.dryRun === true,
    });
    const o = result.options;

    if (!o.dryRun) {
      if (o.out) await writeText(o.out, result.output);
      else await writeStream(process.stdout, result.output);
    }

    const report = renderReport(result);
    if (o.report) await writeText(o.report, report);
    else await writeStream(o.dryRun ? process.stdout : process.stderr, report);

    process.exitCode = exitCodeFor(result);
  });

async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, 'utf8');
}

function writeStream(stream: NodeJS.WriteStream, text: string): Promise<void> {
  return new Promise((resolve, reject) => stream.write(text, (err) => (err ? reject(err) : resolve())));
}

async function main(): Promise<void> {
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  try {
    await program.parseAsync();
  } catch (err) {
    process.stderr.write(`lmpack: error: ${(err as Error).message}\n`);
    process.exitCode = EXIT_ERROR;
  }
}

await main();
