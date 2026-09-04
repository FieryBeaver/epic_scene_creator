/**
 * Hotkeys. All of them stand down while the focus is in a field, except
 * Escape, which cancels link mode or clears the selection.
 */

import { t } from '../i18n/index.js';

import { sel, mode, marked, setMarked, mark, scene } from '../core/state.js';
import { delScene, delConn, duplicateScene } from '../core/model.js';
import { isTyping } from '../util/dom.js';
import { fitAll } from '../ui/camera.js';
import { toggle as toggleMinimap } from '../ui/minimap.js';
import { toggleShortcuts } from '../ui/shortcuts.js';
import { renderAll, deselect, select } from '../ui/render.js';
import { isLinking, stopLink } from './linkmode.js';
import { createSceneAtCenter } from './scenes.js';
import { setMode } from './toolbar.js';

export function initKeyboard(){
  document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(ev){
  // Enter/Space activate a scene card in the rail, which is a div.
  if (ev.key === 'Enter' || ev.key === ' '){
    const card = ev.target.closest && ev.target.closest('.card[data-goto]');
    if (card){
      ev.preventDefault();
      card.click();
      return;
    }
  }

  if (ev.key === 'Escape'){
    if (isLinking()) stopLink();
    else if (isTyping()) ev.target.blur();
    else deselect();
    return;
  }

  // Ctrl+D duplicates, so it has to be read before the modifier guard below.
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')){
    if (isTyping() || mode === 'view') return;
    ev.preventDefault();
    duplicateSelection();
    return;
  }

  if (isTyping() || ev.ctrlKey || ev.metaKey || ev.altKey) return;

  if (ev.key === '?'){ toggleShortcuts(); return; }
  if (ev.key === 'v'){ setMode(mode === 'view' ? 'edit' : 'view'); return; }
  if (ev.key === 'f'){ fitAll(); return; }
  if (ev.key === 'm'){ toggleMinimap(); return; }

  if (mode === 'view') return;

  if (ev.key === 'n'){ createSceneAtCenter(); return; }

  if (ev.key === 'c'){ foldSelection(); return; }

  if (ev.key.startsWith('Arrow') && nudge(ev)) return;

  if (ev.key === 'Delete'){ deleteSelection(); return; }
}

/** Arrow keys move the marked scenes; Shift takes bigger steps. */
const STEP = 8;

function nudge(ev){
  const ids = targets();
  if (!ids.length) return false;
  const far = ev.shiftKey ? 5 : 1;
  const dx = (ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0) * STEP * far;
  const dy = (ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0) * STEP * far;
  if (!dx && !dy) return false;
  ev.preventDefault();
  ids.forEach(id => {
    const s = scene(id);
    if (s){ s.x += dx; s.y += dy; }
  });
  mark();
  renderAll();
  return true;
}

/** The scenes a board-level command applies to. */
function targets(){
  if (marked.size) return [...marked].filter(id => scene(id));
  if (sel && sel.kind === 'scene' && scene(sel.id)) return [sel.id];
  return [];
}

/** Fold every selected card, or unfold them if they are already folded. */
function foldSelection(){
  const ids = targets();
  if (!ids.length) return;
  const open = ids.some(id => !scene(id).collapsed);
  ids.forEach(id => { scene(id).collapsed = open; });
  mark();
  renderAll();
}

function duplicateSelection(){
  const ids = targets();
  if (!ids.length) return;
  const copies = ids.map(id => duplicateScene(id)).filter(Boolean);
  if (!copies.length) return;
  setMarked(copies.map(c => c.id));
  select('scene', copies[0].id);
  renderAll();
}

function deleteSelection(){
  const ids = targets();

  if (ids.length > 1){
    if (!confirm(t('msg.confirmDeleteScenes', { n: ids.length }))) return;
    ids.forEach(delScene);
    setMarked([]);
    renderAll();
    return;
  }

  if (!sel) return;
  if (sel.kind === 'scene'){
    if (confirm(t('msg.confirmDeleteSceneShort'))){ delScene(sel.id); setMarked([]); renderAll(); }
  } else if (sel.kind === 'conn'){
    delConn(sel.id);
    renderAll();
  }
}
