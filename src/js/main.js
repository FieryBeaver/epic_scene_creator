/**
 * Entry point. Wires the modules together and paints the first frame.
 *
 * Module map (see docs/ARCHITECTURE.md):
 *   core/   the board and the rules about it — no DOM
 *   util/   escaping, geometry, small DOM helpers
 *   ui/     rendering: board, edges, inspector, rail, camera, panels
 *   input/  everything that reacts to a person: pointer, keys, forms, toolbar
 */

import { S, onChange, setBoard, clearDirty } from './core/state.js';
import { scheduleAutosave, readAutosave } from './core/autosave.js';
import { SyncEngine } from './core/sync/engine.js';
import { loadConfig, isConfigured } from './core/sync/config.js';
import { initCamera, applyCam, cam, setCamera, fitAll } from './ui/camera.js';
import { applyPanels, initPanels } from './ui/panels.js';
import { renderAll, renderPreservingFocus } from './ui/render.js';
import { initSyncPanel, renderStatus } from './ui/sync-panel.js';
import { toast } from './util/dom.js';
import { initActions } from './input/actions.js';
import { initForms } from './input/forms.js';
import { initKeyboard } from './input/keyboard.js';
import { initPointer } from './input/pointer.js';
import { initToolbar } from './input/toolbar.js';
import { stopLink } from './input/linkmode.js';

/** Shared with the toolbar so "Очистити" can stop the loop and drop the cache. */
export const sync = new SyncEngine({
  getBoard: () => S,
  onRemote: onRemoteChanges,
  onStatus: renderStatus,
});

function onRemoteChanges(ids, overridden){
  renderPreservingFocus();
  if (overridden && overridden.length){
    // Worth saying out loud: this DM's edit to that scene did not survive.
    toast(overridden.length === 1
      ? 'Вашу зміну перезаписано змінами з іншого пристрою'
      : `Ваших змін перезаписано: ${overridden.length}`);
    return;
  }
  toast(ids.length === 1
    ? 'Оновлення з іншого пристрою'
    : `Оновлень з інших пристроїв: ${ids.length}`);
}

/** Bring back whatever this browser had open, so a closed tab costs nothing. */
function restoreAutosave(){
  const saved = readAutosave();
  if (!saved) return false;
  setBoard(saved.board);
  clearDirty();
  applyPanels();
  renderAll();
  if (saved.camera) setCamera(saved.camera); else fitAll();
  if (saved.savedAt){
    const at = new Date(saved.savedAt);
    toast(`Відновлено дошку від ${String(at.getHours()).padStart(2, '0')}:`
      + `${String(at.getMinutes()).padStart(2, '0')}`);
  }
  return true;
}

function start(){
  initCamera();
  initPanels();
  initToolbar();
  initPointer();
  initActions();
  initForms();
  initKeyboard();
  initSyncPanel(sync);

  stopLink();
  applyPanels();
  renderAll();

  const restored = restoreAutosave();
  if (!restored){
    cam.x = 60;
    cam.y = 60;
    applyCam();
  }

  // Autosave and sync both hang off one change hook rather than being called
  // from every mutation site; each debounces internally.
  onChange(() => {
    scheduleAutosave(cam);
    sync.nudge();
  });

  const cfg = loadConfig();
  if (cfg.enabled && isConfigured(cfg)){
    sync.start(cfg).catch(err => console.error('sync failed to start', err));
  }
}

start();
