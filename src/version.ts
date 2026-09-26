import { createRequire } from 'node:module';

// src/version.ts and dist/*.js both sit one level below package.json.
const require = createRequire(import.meta.url);
export const VERSION: string = (require('../package.json') as { version: string }).version;
