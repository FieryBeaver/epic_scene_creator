/**
 * Build the standalone board.
 *
 * The app runs from `src/` as plain ES modules with no build step at all —
 * that is the development story. This script exists for the other one: a
 * single self-contained `dist/index.html` that a DM can download once and
 * open from a USB stick in a basement with no wifi.
 *
 * It inlines every stylesheet and bundles the module graph into one script.
 * The only thing left pointing outward is the Google Fonts link, which
 * degrades to Georgia when it cannot be reached.
 *
 * Usage: node build.mjs [--outdir dist]
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, 'src');
const outDir = resolve(root, argValue('--outdir') || 'dist');

const LINK_RE = /[ \t]*<link rel="stylesheet" href="\.\/([^"]+)">\r?\n?/g;
const SCRIPT_RE = /[ \t]*<script type="module" src="\.\/([^"]+)"><\/script>\r?\n?/;

function argValue(flag){
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

/** Guard against a `</script>` inside the bundle ending the tag early. */
function escapeForInlineScript(code){
  return code.replace(/<\/script>/gi, '<\\/script>');
}

async function main(){
  const html = await readFile(join(srcDir, 'index.html'), 'utf8');

  /* ---------- styles ---------- */
  const sheets = [...html.matchAll(LINK_RE)].map(m => m[1]);
  if (!sheets.length) throw new Error('index.html has no local stylesheets to inline');

  const css = (await Promise.all(
    sheets.map(async p => `/* ${p} */\n` + (await readFile(join(srcDir, p), 'utf8')).trim())
  )).join('\n\n');

  /* ---------- script ---------- */
  const entryMatch = html.match(SCRIPT_RE);
  if (!entryMatch) throw new Error('index.html has no module entry point to bundle');

  const bundle = await build({
    entryPoints: [join(srcDir, entryMatch[1])],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    charset: 'utf8',
    minify: true,
    legalComments: 'none',
    write: false,
  });
  const code = bundle.outputFiles[0].text;

  /* ---------- assemble ---------- */
  let out = html
    .replace(LINK_RE, (_, p) => (p === sheets[0] ? '<style>\n' + css + '\n</style>\n' : ''))
    .replace(SCRIPT_RE, '<script>\n' + escapeForInlineScript(code) + '\n</script>\n');

  if (out.includes('<link rel="stylesheet" href="./')) throw new Error('a stylesheet was left un-inlined');
  if (out.includes('type="module"')) throw new Error('the module entry point was left un-bundled');

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), out, 'utf8');

  const kb = n => (n / 1024).toFixed(1) + ' kB';
  console.log(`dist/index.html  ${kb(Buffer.byteLength(out))}`
    + `  (css ${kb(Buffer.byteLength(css))}, js ${kb(Buffer.byteLength(code))})`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
