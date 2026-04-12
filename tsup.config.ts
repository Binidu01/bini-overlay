import { defineConfig } from 'tsup';

export default defineConfig({
  entry      : ['src/index.ts'],
  format     : ['esm', 'cjs'],
  dts        : { 
    resolve: true,
    compilerOptions: {
      ignoreDeprecations: "6.0"
    }
  },
  clean      : true,
  sourcemap  : true,
  splitting  : false,
  treeshake  : true,
  target     : 'es2022',
  external   : ['vite'],
  esbuildOptions(opts) {
    opts.platform = 'node';
  },
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});