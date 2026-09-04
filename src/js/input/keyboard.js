/**
 * Hotkeys. All of them stand down while the focus is in a field, except
 * Escape, which cancels link mode or clears the selection.
 */

import { sel, mode } from '../core/state.js';
import { delScene, delConn } from '../core/model.js';
import { isTyping } from '../util/dom.js';
import { fitAll } from '../ui/camera.js';
import { renderAll, deselect } from '../ui/render.js';
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

  if (isTyping() || ev.ctrlKey || ev.metaKey || ev.altKey) return;

  if (ev.key === 'v'){ setMode(mode === 'view' ? 'edit' : 'view'); return; }
  if (ev.key === 'f'){ fitAll(); return; }

  if (mode === 'view') return;

  if (ev.key === 'n'){ createSceneAtCenter(); return; }

  if (ev.key === 'Delete' && sel){
    if (sel.kind === 'scene'){
      if (confirm('Видалити сцену?')){ delScene(sel.id); renderAll(); }
    } else if (sel.kind === 'conn'){
      delConn(sel.id);
      renderAll();
    }
  }
}
