/**
 * Bulk actions.
 *
 * Standard toolbar practice: actions for a selection appear when there is a
 * selection, next to it, and go away again. Nothing here is available any
 * other way except by keyboard, so the bar is also how those shortcuts get
 * discovered.
 */

import { t } from '../i18n/index.js';

import { marked, setMarked, mark, scene, mode } from '../core/state.js';
import { delScene, duplicateScene } from '../core/model.js';
import { esc } from '../util/html.js';
import { el } from '../util/dom.js';

export function initSelBar(){
  el('selBar').addEventListener('click', ev => {
    const button = ev.target.closest('[data-bulk]');
    if (button) run(button.getAttribute('data-bulk'));
  });
}

/** Called from the renderer, since it follows the selection. */
export function renderSelBar(){
  const bar = el('selBar');
  if (!bar) return;

  const ids = [...marked].filter(id => scene(id));
  if (ids.length < 2 || mode === 'view'){
    bar.hidden = true;
    return;
  }

  const anyOpen = ids.some(id => !scene(id).collapsed);
  bar.hidden = false;
  bar.innerHTML = `<span class="n">${esc(t('sel.count', { n: ids.length }))}</span>
    <button class="btn sm" data-bulk="fold">${esc(anyOpen ? t('sel.fold') : t('sel.unfold'))} <kbd>c</kbd></button>
    <button class="btn sm" data-bulk="duplicate">${esc(t('sel.duplicate'))} <kbd>Ctrl+D</kbd></button>
    <button class="btn sm" data-bulk="delete">${esc(t('sel.delete'))} <kbd>Del</kbd></button>
    <button class="btn sm" data-bulk="clear" title="${esc(t('sel.clearTip'))}">✕</button>`;
}

function run(action){
  // Imported here rather than at the top: render.js pulls this module in.
  import('./render.js').then(({ renderAll, select }) => {
    const ids = [...marked].filter(id => scene(id));
    if (!ids.length) return;

    if (action === 'clear'){
      setMarked([]);
    } else if (action === 'fold'){
      const open = ids.some(id => !scene(id).collapsed);
      ids.forEach(id => { scene(id).collapsed = open; });
      mark();
    } else if (action === 'duplicate'){
      const copies = ids.map(id => duplicateScene(id)).filter(Boolean);
      setMarked(copies.map(c => c.id));
      if (copies[0]) select('scene', copies[0].id);
    } else if (action === 'delete'){
      if (!confirm(t('msg.confirmDeleteScenes', { n: ids.length }))) return;
      ids.forEach(delScene);
      setMarked([]);
    }

    renderAll();
  });
}
