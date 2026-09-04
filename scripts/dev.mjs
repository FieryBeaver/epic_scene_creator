/**
 * Development server.
 *
 * Plain static serving of `src/` — the app is ES modules and needs no build,
 * it just cannot run from `file://`.
 *
 * Uses esbuild's JS API rather than its CLI: the CLI's serve mode stops the
 * moment stdin closes, which makes `npm run dev` die whenever it is started
 * detached, from a script, or in a terminal that does not hold stdin open.
 * The API keeps serving until the process is asked to stop.
 *
 * Usage: node scripts/dev.mjs [--port 5173] [--host 127.0.0.1]
 */

import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(flag, fallback){
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ctx = await esbuild.context({});
const { hosts, port } = await ctx.serve({
  servedir: join(root, 'src'),
  host: arg('--host', '127.0.0.1'),
  port: Number(arg('--port', 5173)),
});

const host = (hosts && hosts[0]) || '127.0.0.1';
console.log(`Дошка сцен → http://${host}:${port}/`);
console.log('Ctrl+C to stop. Edit anything under src/ and reload — there is no build step.');

for (const signal of ['SIGINT', 'SIGTERM']){
  process.on(signal, async () => {
    await ctx.dispose();
    process.exit(0);
  });
}
