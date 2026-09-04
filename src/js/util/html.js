/**
 * Escaping helpers. Every value that reaches an HTML string has to pass
 * through one of these — board files are imported from disk and are treated
 * as untrusted input.
 */

import { t } from '../i18n/index.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for interpolation into markup or a quoted attribute. */
export function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPES[c]);
}

/**
 * Escape a value that lands inside a `style="…"` attribute.
 *
 * `esc()` is not enough there: a CSS value may not contain quotes, semicolons
 * or parentheses without letting the author of an imported board file inject
 * extra declarations (or a `url(...)` callback). Anything that is not a plain
 * colour keyword or hex/rgb/hsl value is replaced by the fallback.
 */
const COLOR_OK = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(rgb|hsl)a?\([0-9.,%\s/-]+\))$/i;
export function safeColor(value, fallback = '#C7D6E0'){
  const v = String(value == null ? '' : value).trim();
  return COLOR_OK.test(v) ? v : fallback;
}

/**
 * Normalise a user-supplied URL. Only http(s) and mailto survive; anything
 * scheme-less is assumed to be https, and `javascript:` is dropped.
 */
export function safeUrl(u){
  const raw = String(u == null ? '' : u).trim();
  if (!raw) return '';
  if (/^(https?:|mailto:)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';   // any other scheme, javascript: included
  return 'https://' + raw;
}

/** Human label for a link: explicit label, else the host name. */
export function linkLabel(k){
  if (k.label) return k.label;
  try { return new URL(safeUrl(k.url)).hostname.replace(/^www\./, ''); }
  catch { return k.url || t('data.link'); }
}
