/**
 * Translation coverage.
 *
 * Two ways this breaks silently: a dictionary drifts out of step with the
 * other, or a `t('…')` call names a key nobody wrote. Both show up in the
 * interface as a raw key on a button, which nobody notices until a user does.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { uk } from '../src/js/i18n/uk.js';
import { en } from '../src/js/i18n/en.js';
import { t, getLocale, LOCALES } from '../src/js/i18n/index.js';

const DICTS = { uk, en };

function walk(dir, out = []){
  for (const name of readdirSync(dir)){
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const SOURCES = walk('src/js');

test('every shipped locale has a dictionary', () => {
  for (const [code] of LOCALES) assert.ok(DICTS[code], `no dictionary for ${code}`);
});

test('the dictionaries define exactly the same keys', () => {
  const a = new Set(Object.keys(uk));
  const b = new Set(Object.keys(en));
  const onlyUk = [...a].filter(k => !b.has(k));
  const onlyEn = [...b].filter(k => !a.has(k));
  assert.deepEqual(onlyUk, [], 'keys missing from en');
  assert.deepEqual(onlyEn, [], 'keys missing from uk');
});

test('no dictionary entry is empty', () => {
  for (const [code, dict] of Object.entries(DICTS)){
    for (const [k, v] of Object.entries(dict)){
      assert.ok(typeof v === 'string' && v.trim(), `${code}.${k} is empty`);
    }
  }
});

test('every literal t() key exists in both dictionaries', () => {
  const missing = [];
  for (const file of SOURCES){
    if (file.includes('i18n')) continue;
    const src = readFileSync(file, 'utf8');
    // Only complete literal calls: `t('a.b')` or `t('a.b', {…})`. A key built
    // by concatenation — `t('god.' + id)` — is covered by the family test.
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'\s*[),]/g)){
      const key = m[1];
      for (const [code, dict] of Object.entries(DICTS)){
        if (!(key in dict)) missing.push(`${code}: ${key}  (${file})`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('every computed t() prefix has entries behind it', () => {
  // Keys built as t('side.' + v) and friends: check the whole family exists.
  const families = {
    'side.': ['', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up', 'down'],
    'toktype.': ['boss', 'scouts', 'ally', 'party', 'other'],
    'blockkind.': ['loc', 'conn', 'other'],
    'god.': ['obolaka', 'moa', 'wongo', 'papazotl', 'nangnang', 'ijin', 'kubazan', 'shagambi', 'unkh'],
    'godform.': ['obolaka', 'moa', 'wongo', 'papazotl', 'nangnang', 'ijin', 'kubazan', 'shagambi', 'unkh'],
    'shape.': ['k3', 'k4', 'k5', 'k6', 'k8'],
  };
  const missing = [];
  for (const [prefix, suffixes] of Object.entries(families)){
    for (const suffix of suffixes){
      for (const [code, dict] of Object.entries(DICTS)){
        if (!(prefix + suffix in dict)) missing.push(`${code}: ${prefix}${suffix}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('every template has all of its fields, in both languages', async () => {
  const { TPL_DANGER, TPL_BLOCK, TPL_TREASURE, TPL_CONN, TPL_EVENT } =
    await import('../src/js/core/templates.js');
  const shapes = [
    ['danger', TPL_DANGER, ['nm', 'what', 'fix']],
    ['block', TPL_BLOCK, ['nm', 'what', 'key']],
    ['treasure', TPL_TREASURE, ['nm', 'what', 'guard']],
    ['conn', TPL_CONN, ['nm', 'desc']],
    ['event', TPL_EVENT, ['nm', 'trig', 'eff']],
  ];
  const missing = [];
  for (const [kind, list, fields] of shapes){
    for (const tpl of list){
      for (const field of fields){
        const key = `tpl.${kind}.${tpl.id}.${field}`;
        for (const [code, dict] of Object.entries(DICTS)){
          if (!(key in dict)) missing.push(`${code}: ${key}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('the demo names every scene and room it lays out', async () => {
  const missing = [];
  const src = readFileSync('src/js/input/demo.js', 'utf8');
  for (const m of src.matchAll(/'(demo\.[\w]+)'/g)){
    for (const [code, dict] of Object.entries(DICTS)){
      if (!(m[1] in dict)) missing.push(`${code}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('placeholders in a translation match the ones in the original', () => {
  const holes = text => (String(text).match(/\{(\w+)\}/g) || []).sort().join(',');
  const wrong = [];
  for (const [k, v] of Object.entries(uk)){
    if (holes(v) !== holes(en[k])) wrong.push(`${k}: uk[${holes(v)}] en[${holes(en[k])}]`);
  }
  assert.deepEqual(wrong, []);
});

test('t() fills placeholders and survives a missing key', () => {
  assert.equal(t('data.newScene', { n: 3 }), uk['data.newScene'].replace('{3}', '3').replace('{n}', '3'));
  assert.equal(t('nope.not.a.key'), 'nope.not.a.key');
  assert.equal(t('data.newScene'), uk['data.newScene'], 'no vars leaves the placeholder alone');
});

test('the default locale is one we ship', () => {
  assert.ok(LOCALES.some(([code]) => code === getLocale()));
});

test('no UI module still holds a hardcoded Cyrillic string', () => {
  const offenders = [];
  for (const file of SOURCES){
    if (file.includes('i18n')) continue;
    // serialize.js matches values written by old files; they are data, not UI.
    if (file.endsWith('serialize.js')) continue;
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1');  // line comments
    if (/[Ѐ-ӿ]/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
