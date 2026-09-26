---
title: Secret filter
description: Which files lmpack treats as secrets, how they are reported, and how to turn the filter off.
---

A pack is text you are about to paste into a third-party service. The secret
filter keeps the most common credential files out of it. It is on by default
and turns off only with `--allow-secrets`.

## By file name

A file is dropped when its **name** (not the full path) matches one of these
globs, ignoring case:

| Glob | Catches |
|---|---|
| `.env` | environment files |
| `.env.*` | `.env.local`, `.env.production` |
| `*.key` | private keys |
| `*.pem` | keys and certificates in PEM form |
| `*.p12` | PKCS#12 bundles |
| `id_*` | SSH keys: `id_rsa`, `id_ed25519` |
| `*secret*` | `client_secret.json`, `secrets.yaml` |
| `*.kdbx` | KeePass databases |

Matching the name only means that `src/secrets.ts` is dropped, while a
`secrets/README.md` is not. Some names are caught by mistake, such as
`id_utils.ts`; the report shows every such file, so a false positive is easy
to spot.

## By content

A file is also dropped when it contains PEM armor for a private key (any
`BEGIN … PRIVATE KEY` line, including RSA, EC and OpenSSH keys) or a
certificate. Only full armor lines with the five dashes count, so text that
merely mentions a private key is not affected.

## In the report

Every dropped file gets its own line with the rule that matched:

```
Skipped: 3
  secret  .env               name matches .env
  secret  certs/server.pem   name matches *.pem
  secret  deploy/config.txt  contains a PEM private key
```

The report never includes file contents.

Files ignored by `.gitignore` are reported as `ignored` before the secret
filter sees them. A `.env` listed in `.gitignore` shows up as `ignored`, and
it is still not packed.

## Limits

The filter looks at file names and PEM armor. It does not scan file contents
for API keys, tokens, passwords or connection strings, so a key hard-coded in
`config.ts` goes into the pack. Review the pack before sending it anywhere
you do not control. If you need a content scanner, run a dedicated tool such
as [gitleaks](https://github.com/gitleaks/gitleaks) or
[Secretlint](https://github.com/secretlint/secretlint) on the project, or on
the pack file.

## Turning it off

```bash
npx lmpack pack --allow-secrets
```

The flag exists only on the command line; `lmpack.json` cannot turn the filter
off, so a committed config never disables it for everyone.
