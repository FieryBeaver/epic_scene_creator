/**
 * Sync settings and status.
 *
 * A pill in the top bar says where things stand at a glance; clicking it
 * opens the settings sheet. The token field is deliberately blunt about what
 * it does — it is stored in this browser and nowhere else, and it never goes
 * into an exported board.
 */

import { esc } from '../util/html.js';
import { t } from '../i18n/index.js';
import { el, toast } from '../util/dom.js';
import { loadConfig, saveConfig, clearConfig, isConfigured, shareLink, deviceId }
  from '../core/sync/config.js';
import { GitHubFile } from '../core/sync/github.js';

const PHASE = {
  off:        { cls: 'off',  key: 'sync.off' },
  connecting: { cls: 'busy', key: 'sync.connecting' },
  syncing:    { cls: 'busy', key: 'sync.syncing' },
  merging:    { cls: 'busy', key: 'sync.merging' },
  synced:     { cls: 'ok',   key: 'sync.synced' },
  offline:    { cls: 'bad',  key: 'sync.offline' },
  error:      { cls: 'bad',  key: 'sync.error' },
};

let engine = null;

export function initSyncPanel(syncEngine){
  engine = syncEngine;
  el('bSync').addEventListener('click', open);
  el('syncModal').addEventListener('click', ev => {
    if (ev.target.id === 'syncModal') close();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !el('syncModal').hidden){ ev.stopPropagation(); close(); }
  }, true);
  renderStatus({ phase: 'off' });
}

/* ---------- the pill ---------- */

export function renderStatus(state){
  const pill = el('bSync');
  if (!pill) return;
  const p = PHASE[state.phase] || PHASE.off;
  pill.className = p.cls;

  let text = t(p.key);
  if (state.phase === 'synced' && state.at){
    text = t('sync.syncedAt', { time: clock(state.at) });
  }
  pill.innerHTML = `<i class="dot"></i>${esc(text)}`;
  pill.title = state.error
    ? state.error
    : (state.rate != null ? t('sync.rate', { n: state.rate }) : text);
}

function clock(ts){
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ---------- the sheet ---------- */

function open(){
  const cfg = loadConfig();
  el('syncModal').innerHTML = sheet(cfg);
  el('syncModal').hidden = false;
  wire();
  const first = el('syncOwner');
  if (first) first.focus();
}

function close(){
  el('syncModal').hidden = true;
  el('syncModal').innerHTML = '';
}

function sheet(cfg){
  const connected = isConfigured(cfg) && cfg.enabled;
  return `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="syncTitle">
    <header>
      <h2 id="syncTitle">${esc(t('sync.title'))}</h2>
      <button class="btn sm" data-sync-close>✕</button>
    </header>
    <div class="body">
      <p class="hint">${esc(t('sync.intro'))}</p>

      <div class="grid2">
        <label class="f"><span>${esc(t('sync.owner'))}</span>
          <input type="text" id="syncOwner" placeholder="FieryBeaver" value="${esc(cfg.owner)}"></label>
        <label class="f"><span>${esc(t('sync.repo'))}</span>
          <input type="text" id="syncRepo" placeholder="epic-boards" value="${esc(cfg.repo)}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>${esc(t('sync.path'))}</span>
          <input type="text" id="syncPath" placeholder="board.json" value="${esc(cfg.path)}"></label>
        <label class="f"><span>${esc(t('sync.branch'))}</span>
          <input type="text" id="syncBranch" placeholder="main" value="${esc(cfg.branch)}"></label>
      </div>

      <label class="f"><span>${esc(t('sync.token'))}</span>
        <input type="password" id="syncToken" autocomplete="off" spellcheck="false"
          placeholder="github_pat_…" value="${esc(cfg.token)}"></label>

      <p class="note">${t('sync.tokenNote')}</p>

      <div class="row">
        <button class="btn" id="syncTest">${esc(t('sync.test'))}</button>
        <button class="btn acc" id="syncConnect">${esc(connected ? t('sync.reconnect') : t('sync.connect'))}</button>
        <button class="btn" id="syncNow" ${connected ? '' : 'disabled'}>${esc(t('sync.syncNow'))}</button>
        <span class="status" id="syncMsg"></span>
      </div>

      ${cfg.owner && cfg.repo ? `<div class="sep"></div>
        <label class="f"><span>${esc(t('sync.shareLabel'))}</span>
          <input type="text" id="syncShare" readonly value="${esc(shareLink(cfg))}"></label>
        <button class="btn sm" id="syncCopy">${esc(t('sync.copyLink'))}</button>` : ''}

      <div class="sep"></div>
      <div class="row">
        <button class="btn warn" id="syncForget">${esc(t('sync.forget'))}</button>
        <span class="hint" style="margin:0">${esc(t('sync.thisDevice'))} <code>${esc(deviceId())}</code></span>
      </div>
    </div>
  </div>`;
}

function fields(){
  return {
    owner: el('syncOwner').value.trim(),
    repo: el('syncRepo').value.trim(),
    path: el('syncPath').value.trim() || 'board.json',
    branch: el('syncBranch').value.trim(),
    token: el('syncToken').value.trim(),
  };
}

function say(text, kind){
  const box = el('syncMsg');
  if (!box) return;
  box.className = 'status' + (kind ? ' ' + kind : '');
  box.textContent = text;
}

function wire(){
  el('syncModal').querySelector('[data-sync-close]').onclick = close;

  el('syncTest').onclick = async () => {
    const cfg = fields();
    if (!isConfigured(cfg)) return say(t('sync.fillAll'), 'bad');
    say(t('sync.checking'));
    try {
      const info = await new GitHubFile(cfg).probe();
      const canWrite = info.permissions.push || info.permissions.admin || info.permissions.maintain;
      say(canWrite
        ? t(info.private ? 'sync.accessOkPrivate' : 'sync.accessOkPublic')
        : t('sync.noWrite'), canWrite ? 'ok' : 'bad');
    } catch (err){
      say(readable(err), 'bad');
    }
  };

  el('syncConnect').onclick = async () => {
    const cfg = fields();
    if (!isConfigured(cfg)) return say(t('sync.fillAll'), 'bad');
    saveConfig(Object.assign({}, cfg, { enabled: true }));
    say(t('sync.connectingMsg'));
    try {
      await engine.start(cfg);
      say(t('sync.done'), 'ok');
      toast(t('msg.syncConnected'));
      close();
    } catch (err){
      say(readable(err), 'bad');
    }
  };

  el('syncNow').onclick = async () => {
    say(t('sync.syncingMsg'));
    await engine.syncNow();
    say(engine.state.error || t('sync.done'), engine.state.error ? 'bad' : 'ok');
  };

  const copy = el('syncCopy');
  if (copy) copy.onclick = async () => {
    const input = el('syncShare');
    input.select();
    try { await navigator.clipboard.writeText(input.value); toast(t('msg.copyLink')); }
    catch { toast(t('msg.copyManually')); }
  };

  el('syncForget').onclick = () => {
    if (!confirm(t('msg.confirmForget'))) return;
    engine.stop();
    clearConfig();
    close();
    toast(t('msg.syncForgotten'));
  };
}

/** GitHub's own wording is terse; give the common failures a plain sentence. */
function readable(err){
  const status = err && err.status;
  if (status === 401) return t('sync.errTokenBad');
  if (status === 403) return t('sync.errNoAccess');
  if (status === 404) return t('sync.errNotFound');
  if (status === 409 || status === 422) return t('sync.errConflict');
  return String(err && err.message || err);
}
