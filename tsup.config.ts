import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // tsup passes baseUrl to the dts build, which TypeScript 6 flags as deprecated.
  dts: { entry: 'src/index.ts', compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: false,
  splitting: true,
});
