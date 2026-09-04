/**
 * Escaping. A board file is hand-editable and arrives from disk, so every
 * value it carries is untrusted; these are the three gates it passes through.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { esc, safeColor, safeUrl, linkLabel } from '../src/js/util/html.js';

test('esc neutralises the five markup characters', () => {
  assert.equal(esc(`<img src=x onerror="alert(1)">`),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(esc("it's"), 'it&#39;s');
  assert.equal(esc('a & b'), 'a &amp; b');
});

test('esc turns null and undefined into an empty string', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
});

test('safeColor passes real colours through', () => {
  for (const c of ['#fff', '#54BE9B', '#54BE9BAA', 'red', 'rebeccapurple',
                   'rgb(1, 2, 3)', 'rgba(1,2,3,.5)', 'hsl(120 50% 50%)']){
    assert.equal(safeColor(c), c, c);
  }
});

test('safeColor rejects anything that could add a declaration', () => {
  // The attack: a colour that closes the attribute and opens an event handler.
  assert.equal(safeColor('red" onmouseover="steal()" x="'), '#C7D6E0');
  assert.equal(safeColor('red;background:url(//evil)'), '#C7D6E0');
  assert.equal(safeColor('url(//evil)'), '#C7D6E0');
  assert.equal(safeColor('expression(alert(1))'), '#C7D6E0');
  assert.equal(safeColor(''), '#C7D6E0');
  assert.equal(safeColor(null), '#C7D6E0');
});

test('safeColor honours the caller fallback', () => {
  assert.equal(safeColor('nope"', '#54685C'), '#54685C');
});

test('safeUrl keeps the three schemes a link may use', () => {
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeUrl('http://example.com'), 'http://example.com');
  assert.equal(safeUrl('mailto:dm@example.com'), 'mailto:dm@example.com');
});

test('safeUrl assumes https for a bare host', () => {
  assert.equal(safeUrl('example.com/map.png'), 'https://example.com/map.png');
  assert.equal(safeUrl('  example.com  '), 'https://example.com');
});

test('safeUrl drops every other scheme', () => {
  for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>',
                   'vbscript:msgbox', 'file:///etc/passwd']){
    assert.equal(safeUrl(u), '', u);
  }
  assert.equal(safeUrl(''), '');
});

test('linkLabel falls back to the host name', () => {
  assert.equal(linkLabel({ label: 'battlemap', url: 'https://x.test' }), 'battlemap');
  assert.equal(linkLabel({ url: 'https://www.example.com/deep/path' }), 'example.com');
  assert.equal(linkLabel({ url: '' }), 'посилання');
});
