/**
 * Render coordinator and selection.
 *
 * Everything that changes the board calls one of these instead of touching a
 * renderer directly, which keeps the "what changed" decision in one place.
 */

import { sel, setSel } from '../core/state.js';
import { renderBoard } from './board.js';
import { renderInsp } from './inspector/index.js';
import { renderRail, renderPaneScenes } from './rail.js';

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
