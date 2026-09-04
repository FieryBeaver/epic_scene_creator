/**
 * Top bar: new scene, link mode, fit, mode switch, zoom, import/export,
 * demo layout and clear. Also owns the unsaved-changes guard.
 */

import { t } from '../i18n/index.js';

import { S, sel, mode, setBoard, setModeValue, setSel, blank, clearDirty, dirty } from '../core/state.js';
import { serialize, deserialize, exportFilename } from '../core/serialize.js';
import { el, toast } from '../util/dom.js';
import { cam, fitAll, setZoom, setCamera, drawGrid, ZOOM_MIN, ZOOM_MAX } from '../ui/camera.js';
import { applyPanels } from '../ui/panels.js';
import { renderAll } from '../ui/render.js';
import { renderDirty } from '../ui/dirty.js';
import { setTab } from '../ui/rail.js';
import { showShortcuts } from '../ui/shortcuts.js';
import { toggleLink, stopLink } from './linkmode.js';
import { createSceneAtCenter } from './scenes.js';
import { buildDemoBoard } from './demo.js';
import { clearAutosave, writeNow } from '../core/autosave.js';

export function initToolbar(){
  initTitle();
  initMoreMenu();
  el('bAddScene').onclick = () => createSceneAtCenter();
  el('bLink').onclick = () => toggleLink(selectedSceneId());
  el('bFit').onclick = () => fitAll();
  el('bMode').onclick = () => setMode(mode === 'view' ? 'edit' : 'view');

  el('zIn').onclick = () => setZoom(Math.min(ZOOM_MAX, cam.z * 1.2));
  el('zOut').onclick = () => setZoom(Math.max(ZOOM_MIN, cam.z / 1.2));
  el('zRst').onclick = () => setZoom(1);

  el('bExport').onclick = exportBoard;
  el('fileIn').onchange = importBoard;

  el('tabs').addEventListener('click', onTabClick);

  window.addEventListener('beforeunload', ev => {
    if (!dirty) return;
    ev.preventDefault();
    ev.returnValue = '';
  });
}

/**
 * The heading is the board's own name, not the app's. One tool, many
 * campaigns — the file says which one this is, and it travels with the board.
 */
function initTitle(){
  const input = el('boardTitle');
  input.addEventListener('input', syncDocumentTitle);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === 'Escape') input.blur();
  });
  refreshTitle();
}

/** Push the board's title into the field and the browser tab. */
export function refreshTitle(){
  const input = el('boardTitle');
  if (input && document.activeElement !== input) input.value = S.title || '';
  syncDocumentTitle();
}

function syncDocumentTitle(){
  const name = (el('boardTitle').value || '').trim();
  document.title = name ? `${name} — ${t('app.name')}` : t('app.name');
}

/* ---------- overflow menu ---------- */

function initMoreMenu(){
  const button = el('bMore');
  const menu = el('moreMenu');

  const close = () => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.onclick = ev => {
    ev.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('button:not([hidden])').focus();
  };

  menu.addEventListener('click', ev => {
    const item = ev.target.closest('[data-more]');
    if (!item) return;
    close();
    const action = item.getAttribute('data-more');
    if (action === 'import') el('fileIn').click();
    if (action === 'demo') loadDemo();
    if (action === 'clear') clearBoard();
    if (action === 'help') showShortcuts();
  });

  document.addEventListener('click', ev => {
    if (!menu.hidden && !menu.contains(ev.target) && ev.target !== button) close();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !menu.hidden){ close(); button.focus(); }
  });
}

function selectedSceneId(){
  return sel && sel.kind === 'scene' ? sel.id : null;
}

/* ---------- mode ---------- */

export function setMode(next){
  setModeValue(next);
  document.body.classList.toggle('view', next === 'view');
  el('bMode').textContent = next === 'view' ? t('top.edit') : t('top.view');
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
  renderDirty();          // clearDirty() is not a change, so nothing else redraws it
  writeNow(cam);
  toast(t('msg.saved'));
}

function importBoard(ev){
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      installBoard(deserialize(raw), raw.camera);
      toast(t('msg.loaded', { scenes: S.scenes.length, conns: S.connections.length,
                              tokens: S.tokens.length }));
    } catch (err){
      alert(t('msg.readFailed', { error: err.message }));
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
  refreshTitle();
  renderAll();
  if (camera) setCamera(camera);
  else fitAll();
}

/* ---------- demo / clear ---------- */

function loadDemo(){
  if (S.scenes.length && !confirm(t('msg.replaceWithDemo'))) return;
  buildDemoBoard();
  refreshTitle();
  renderAll();
  fitAll();
  toast(t('msg.demoLoaded'));
}

function clearBoard(){
  if (!confirm(t('msg.confirmClear'))) return;
  clearAutosave();
  setBoard(blank());
  setSel(null);
  clearDirty();
  applyPanels();
  refreshTitle();
  renderAll();
  fitAll();
  drawGrid();
}
