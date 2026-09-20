import { defineConfig } from 'tsup';

export default defineConfig({
  entry      : ['src/index.ts'],
  format     : ['esm', 'cjs'],
  dts        : true,
  clean      : true,
  sourcemap  : true,
  splitting  : false,
  treeshake  : true,
  target     : 'es2022',
  external   : ['vite', 'bini-router', '@jridgewell/trace-mapping'],
  esbuildOptions(opts) {
    opts.platform = 'node';
  },
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});