/**
 * Keyboard reference.
 *
 * The board grew enough shortcuts that they need somewhere to be listed —
 * standard practice is a cheat sheet on `?`, discoverable from the menu so
 * nobody has to already know the shortcut for the shortcut list.
 */

import { t } from '../i18n/index.js';

import { esc } from '../util/html.js';
import { el } from '../util/dom.js';

/** Key label, then the key of the sentence describing it. */
const GROUPS = [
  ['keys.gBoard', [
    ['keys.wheel', 'keys.wheelWhat'],
    ['keys.dragBg', 'keys.dragBgWhat'],
    ['keys.shiftDrag', 'keys.shiftDragWhat'],
    ['keys.shiftClick', 'keys.shiftClickWhat'],
    ['f', 'keys.fWhat'],
    ['m', 'keys.mWhat'],
    ['v', 'keys.vWhat'],
  ]],
  ['keys.gScenes', [
    ['n', 'keys.nWhat'],
    ['keys.dblclick', 'keys.dblclickWhat'],
    ['keys.dragHead', 'keys.dragHeadWhat'],
    ['keys.arrows', 'keys.arrowsWhat'],
    ['keys.shiftArrows', 'keys.shiftArrowsWhat'],
    ['keys.ctrlD', 'keys.ctrlDWhat'],
    ['c', 'keys.cWhat'],
    ['Delete', 'keys.delWhat'],
  ]],
  ['keys.gOther', [
    ['Esc', 'keys.escWhat'],
    ['?', 'keys.helpWhat'],
    ['keys.gutter', 'keys.gutterWhat'],
  ]],
];

/** Literal keys stay as they are; anything namespaced is looked up. */
const label = v => (v.includes('.') ? t(v) : v);

export function initShortcuts(){
  const box = el('helpModal');
  box.addEventListener('click', ev => {
    if (ev.target === box || ev.target.closest('[data-help-close]')) hideShortcuts();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !box.hidden){ ev.stopPropagation(); hideShortcuts(); }
  }, true);
}

export function showShortcuts(){
  const box = el('helpModal');
  box.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
    <header>
      <h2 id="helpTitle">${esc(t('keys.title'))}</h2>
      <button class="btn sm" data-help-close>✕</button>
    </header>
    <div class="body">
      ${GROUPS.map(([title, rows]) => `<div class="keys">
        <h4>${esc(t(title))}</h4>
        ${rows.map(([k, what]) =>
          `<div class="krow"><kbd>${esc(label(k))}</kbd><span>${esc(t(what))}</span></div>`).join('')}
      </div>`).join('')}
    </div>
  </div>`;
  box.hidden = false;
  const close = box.querySelector('[data-help-close]');
  if (close) close.focus();
}

export function hideShortcuts(){
  const box = el('helpModal');
  box.hidden = true;
  box.innerHTML = '';
}

export function toggleShortcuts(){
  el('helpModal').hidden ? showShortcuts() : hideShortcuts();
}
