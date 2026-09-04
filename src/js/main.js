/**
 * Entry point. Wires the modules together and paints the first frame.
 *
 * Module map (see docs/ARCHITECTURE.md):
 *   core/   the board and the rules about it — no DOM
 *   util/   escaping, geometry, small DOM helpers
 *   ui/     rendering: board, edges, inspector, rail, camera, panels
 *   input/  everything that reacts to a person: pointer, keys, forms, toolbar
 */

import { initCamera, applyCam, cam } from './ui/camera.js';
import { applyPanels, initPanels } from './ui/panels.js';
import { renderAll } from './ui/render.js';
import { initActions } from './input/actions.js';
import { initForms } from './input/forms.js';
import { initKeyboard } from './input/keyboard.js';
import { initPointer } from './input/pointer.js';
import { initToolbar } from './input/toolbar.js';
import { stopLink } from './input/linkmode.js';

function start(){
  initCamera();
  initPanels();
  initToolbar();
  initPointer();
  initActions();
  initForms();
  initKeyboard();

  stopLink();
  applyPanels();
  renderAll();

  cam.x = 60;
  cam.y = 60;
  applyCam();
}

start();
