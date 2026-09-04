/**
 * Render coordinator and selection.
 *
 * Everything that changes the board calls one of these instead of touching a
 * renderer directly, which keeps the "what changed" decision in one place.
 */

import { sel, setSel } from '../core/state.js';
import { renderBoard } from './board.js';
import { renderInsp } from './inspector/index.js';
import { renderRail, renderPaneScenes, renderTabs, refreshRegPanes } from './rail.js';

export function renderAll(){
  renderBoard();
  renderInsp();
  renderRail();
}

/**
 * Cheap refresh for text the user is typing: the card on the board and the
 * scene list follow along, while the inspector is left alone so the caret
 * stays where it is.
 */
export function renderLive(){
  renderBoard();
  renderPaneScenes();
  renderTabs();          // a list being renamed should retitle its own tab as you type
  refreshRegPanes();     // a room's description is also the list item's
}

/**
 * Full refresh that survives a DM typing into the inspector.
 *
 * A merge from another device can land at any moment, including mid-sentence.
 * Replacing the panel's innerHTML would take the focused field with it, so
 * the field is found again afterwards by its `data-path` and the caret put
 * back where it was.
 */
export function renderPreservingFocus(){
  const active = document.activeElement;
  const path = active && active.getAttribute && active.getAttribute('data-path');

  if (!path){
    renderAll();
    return;
  }

  const start = active.selectionStart;
  const end = active.selectionEnd;
  const scrollTop = document.getElementById('insp').scrollTop;

  renderAll();

  const again = document.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!again) return;
  again.focus();
  try { again.setSelectionRange(start, end); } catch { /* not a text field */ }
  document.getElementById('insp').scrollTop = scrollTop;
}

export function select(kind, id){
  if (sel && sel.kind === kind && sel.id === id) return;
  setSel({ kind, id });
  renderAll();
}

export function deselect(){
  if (!sel) return;
  setSel(null);
  renderAll();
}
