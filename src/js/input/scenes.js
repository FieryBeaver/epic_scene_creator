/**
 * Creating a scene, from wherever the request came: the toolbar, a hotkey or
 * a double click on empty board.
 */

import { newScene } from '../core/model.js';
import { NODE_W } from '../ui/nodes.js';
import { viewCenter } from '../ui/camera.js';
import { renderAll, select } from '../ui/render.js';

/** New scene with its top-left corner at the given world position. */
export function createSceneAt(x, y){
  const s = newScene(x, y);
  renderAll();
  select('scene', s.id);
  return s;
}

/** New scene centred in whatever part of the board is on screen. */
export function createSceneAtCenter(){
  const w = viewCenter();
  return createSceneAt(Math.round(w.x - NODE_W / 2), Math.round(w.y - 50));
}
