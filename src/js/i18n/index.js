/**
 * Language.
 *
 * Two shipped: Ukrainian, which the tool was written in, and English. The
 * choice is per device — a board is shared between DMs who need not read the
 * same language, so it must not travel in the file.
 *
 * There are two kinds of string here and they behave differently:
 *
 *   Interface — buttons, labels, hints. Looked up on every render, so
 *   switching language redraws the app and nothing else changes.
 *
 *   Content — the name a new scene gets, the text a template inserts. Read
 *   once, at the moment of creation, and then it is the DM's data. Switching
 *   language afterwards must not rewrite what someone wrote.
 */

import { uk } from './uk.js';
import { en } from './en.js';

const DICTS = { uk, en };
const FALLBACK = 'uk';
const STORE_KEY = 'toa-board-lang';

export const LOCALES = [
  ['uk', 'Українська'],
  ['en', 'English'],
];

let locale = detect();
const watchers = new Set();

function store(){
  try { return window.localStorage; } catch { return null; }
}

/** Stored choice, else the first browser language we speak, else Ukrainian. */
function detect(){
  const ls = store();
  let saved = null;
  try { saved = ls && ls.getItem(STORE_KEY); } catch { saved = null; }
  if (saved && DICTS[saved]) return saved;

  const offered = (typeof navigator !== 'undefined' && navigator.languages)
    || (typeof navigator !== 'undefined' && navigator.language ? [navigator.language] : []);
  for (const tag of offered){
    const code = String(tag).slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return FALLBACK;
}

export function getLocale(){
  return locale;
}

export function setLocale(next){
  if (!DICTS[next] || next === locale) return false;
  locale = next;
  try { const ls = store(); ls && ls.setItem(STORE_KEY, next); } catch { /* private mode */ }
  applyDocumentLang();
  watchers.forEach(fn => fn(locale));
  return true;
}

export function onLocaleChange(fn){
  watchers.add(fn);
  return () => watchers.delete(fn);
}

export function applyDocumentLang(){
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/**
 * Look up a string. `{name}` placeholders are filled from `vars`.
 *
 * A missing key falls back to Ukrainian and then to the key itself, so a gap
 * shows up as a visible marker rather than an empty button. The test suite
 * checks both dictionaries against every call site, so gaps do not ship.
 */
export function t(key, vars){
  const dict = DICTS[locale] || DICTS[FALLBACK];
  let text = dict[key];
  if (text == null) text = DICTS[FALLBACK][key];
  if (text == null) return key;
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (whole, name) =>
    (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole));
}
