import { build } from 'esbuild';

console.log('Building EVE Frontier IDS...');

await build({
  entryPoints: ['src/server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['fsevents'],
  define: {
    'import.meta.url': '"file:///app/server.cjs"',
  },
});

console.log('Bundle created — dist/server.cjs');
console.log('Done!');
