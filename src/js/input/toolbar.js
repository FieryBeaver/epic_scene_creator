/**
 * Top bar: new scene, link mode, fit, mode switch, zoom, import/export,
 * demo layout and clear. Also owns the unsaved-changes guard.
 */

import { S, sel, mode, setBoard, setModeValue, setSel, blank, clearDirty, dirty } from '../core/state.js';
import { serialize, deserialize, exportFilename } from '../core/serialize.js';
import { el, toast } from '../util/dom.js';
import { cam, fitAll, setZoom, setCamera, drawGrid, ZOOM_MIN, ZOOM_MAX } from '../ui/camera.js';
import { applyPanels } from '../ui/panels.js';
import { renderAll } from '../ui/render.js';
import { setTab } from '../ui/rail.js';
import { toggleLink, stopLink } from './linkmode.js';
import { createSceneAtCenter } from './scenes.js';
import { buildDemoBoard } from './demo.js';
import { clearAutosave, writeNow } from '../core/autosave.js';

export function initToolbar(){
  el('bAddScene').onclick = () => createSceneAtCenter();
  el('bLink').onclick = () => toggleLink(selectedSceneId());
  el('bFit').onclick = () => fitAll();
  el('bMode').onclick = () => setMode(mode === 'view' ? 'edit' : 'view');

  el('zIn').onclick = () => setZoom(Math.min(ZOOM_MAX, cam.z * 1.2));
  el('zOut').onclick = () => setZoom(Math.max(ZOOM_MIN, cam.z / 1.2));
  el('zRst').onclick = () => setZoom(1);

  el('bExport').onclick = exportBoard;
  el('bImport').onclick = () => el('fileIn').click();
  el('fileIn').onchange = importBoard;

  el('bDemo').onclick = loadDemo;
  el('bClear').onclick = clearBoard;

  el('tabs').addEventListener('click', onTabClick);

  window.addEventListener('beforeunload', ev => {
    if (!dirty) return;
    ev.preventDefault();
    ev.returnValue = '';
  });
}

function selectedSceneId(){
  return sel && sel.kind === 'scene' ? sel.id : null;
}

/* ---------- mode ---------- */

export function setMode(next){
  setModeValue(next);
  document.body.classList.toggle('view', next === 'view');
  el('bMode').textContent = next === 'view' ? '✎ Режим редагування' : '👁 Режим перегляду';
  if (next === 'view') stopLink();
  renderAll();
}

/* ---------- rail tabs ---------- */

function onTabClick(ev){
  const b = ev.target.closest('#tabs button[data-p]');
  if (b) setTab(b.dataset.p);
}

/* ---------- import / export ---------- */

function exportBoard(){
  const data = serialize(S, cam);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  clearDirty();
  writeNow(cam);
  toast('JSON збережено');
}

function importBoard(ev){
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      installBoard(deserialize(raw), raw.camera);
      toast(`Завантажено: ${S.scenes.length} сцен, ${S.connections.length} з'єднань, `
        + `${S.tokens.length} токенів`);
    } catch (err){
      alert('Не вдалося прочитати файл: ' + err.message);
    }
    ev.target.value = '';
  };
  reader.readAsText(file);
}

/** Replace the board and bring the whole UI back in step with it. */
function installBoard(board, camera){
  setBoard(board);
  setSel(null);
  clearDirty();
  applyPanels();
  renderAll();
  if (camera) setCamera(camera);
  else fitAll();
}

/* ---------- demo / clear ---------- */

function loadDemo(){
  if (S.scenes.length && !confirm('Замінити поточну дошку демо-розкладкою?')) return;
  buildDemoBoard();
  renderAll();
  fitAll();
  toast('Демо: 12 сцен, дев\'ять гробниць і п\'ять ключів розставлені');
}

function clearBoard(){
  if (!confirm('Очистити дошку? Незбережені дані буде втрачено.')) return;
  clearAutosave();
  setBoard(blank());
  setSel(null);
  clearDirty();
  applyPanels();
  renderAll();
  fitAll();
  drawGrid();
}
