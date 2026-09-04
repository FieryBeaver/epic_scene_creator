/**
 * Sync settings and status.
 *
 * A pill in the top bar says where things stand at a glance; clicking it
 * opens the settings sheet. The token field is deliberately blunt about what
 * it does — it is stored in this browser and nowhere else, and it never goes
 * into an exported board.
 */

import { esc } from '../util/html.js';
import { el, toast } from '../util/dom.js';
import { loadConfig, saveConfig, clearConfig, isConfigured, shareLink, deviceId }
  from '../core/sync/config.js';
import { GitHubFile } from '../core/sync/github.js';

const PHASE = {
  off:        { cls: 'off',  text: 'Синхронізація вимкнена' },
  connecting: { cls: 'busy', text: 'Під\'єднання…' },
  syncing:    { cls: 'busy', text: 'Синхронізація…' },
  merging:    { cls: 'busy', text: 'Злиття змін…' },
  synced:     { cls: 'ok',   text: 'Синхронізовано' },
  offline:    { cls: 'bad',  text: 'Немає мережі' },
  error:      { cls: 'bad',  text: 'Помилка' },
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

  let text = p.text;
  if (state.phase === 'synced' && state.at){
    text = 'Синхронізовано ' + clock(state.at);
  }
  pill.innerHTML = `<i class="dot"></i>${esc(text)}`;
  pill.title = state.error
    ? state.error
    : (state.rate != null ? `Залишок запитів до GitHub: ${state.rate}` : text);
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
      <h2 id="syncTitle">Спільна дошка</h2>
      <button class="btn sm" data-sync-close>✕</button>
    </header>
    <div class="body">
      <p class="hint">Дошка зберігається як JSON-файл у приватному репозиторії GitHub.
        Кожен ДМ під'єднує свій токен зі свого пристрою; кожне збереження — це коміт,
        тож видно історію і хто що змінив.</p>

      <div class="grid2">
        <label class="f"><span>Власник (owner)</span>
          <input type="text" id="syncOwner" placeholder="FieryBeaver" value="${esc(cfg.owner)}"></label>
        <label class="f"><span>Репозиторій</span>
          <input type="text" id="syncRepo" placeholder="epic-boards" value="${esc(cfg.repo)}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Файл</span>
          <input type="text" id="syncPath" placeholder="board.json" value="${esc(cfg.path)}"></label>
        <label class="f"><span>Гілка (порожньо — типова)</span>
          <input type="text" id="syncBranch" placeholder="main" value="${esc(cfg.branch)}"></label>
      </div>

      <label class="f"><span>Персональний токен</span>
        <input type="password" id="syncToken" autocomplete="off" spellcheck="false"
          placeholder="github_pat_…" value="${esc(cfg.token)}"></label>

      <p class="note"><b>Про токен.</b> Він зберігається лише в цьому браузері
        (localStorage) і ніколи не потрапляє у файл дошки чи в експорт. Створіть
        <i>fine-grained</i> токен із доступом <b>Contents: Read and write</b> лише до
        цього репозиторію. На чужому чи спільному комп'ютері не зберігайте його —
        натисніть «Забути на цьому пристрої», коли закінчите.</p>

      <div class="row">
        <button class="btn" id="syncTest">Перевірити доступ</button>
        <button class="btn acc" id="syncConnect">${connected ? 'Перепід\'єднати' : 'Під\'єднати'}</button>
        <button class="btn" id="syncNow" ${connected ? '' : 'disabled'}>Синхронізувати зараз</button>
        <span class="status" id="syncMsg"></span>
      </div>

      ${cfg.owner && cfg.repo ? `<div class="sep"></div>
        <label class="f"><span>Посилання для інших ДМ (без токена)</span>
          <input type="text" id="syncShare" readonly value="${esc(shareLink(cfg))}"></label>
        <button class="btn sm" id="syncCopy">Скопіювати посилання</button>` : ''}

      <div class="sep"></div>
      <div class="row">
        <button class="btn warn" id="syncForget">Забути на цьому пристрої</button>
        <span class="hint" style="margin:0">Цей пристрій: <code>${esc(deviceId())}</code></span>
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
    if (!isConfigured(cfg)) return say('Заповніть усі поля', 'bad');
    say('Перевіряю…');
    try {
      const info = await new GitHubFile(cfg).probe();
      const canWrite = info.permissions.push || info.permissions.admin || info.permissions.maintain;
      say(canWrite
        ? `Доступ є${info.private ? ' · репозиторій приватний' : ' · УВАГА: репозиторій публічний'}`
        : 'Токен бачить репозиторій, але не має права запису', canWrite ? 'ok' : 'bad');
    } catch (err){
      say(readable(err), 'bad');
    }
  };

  el('syncConnect').onclick = async () => {
    const cfg = fields();
    if (!isConfigured(cfg)) return say('Заповніть усі поля', 'bad');
    saveConfig(Object.assign({}, cfg, { enabled: true }));
    say('Під\'єднуюсь…');
    try {
      await engine.start(cfg);
      say('Готово', 'ok');
      toast('Спільну дошку під\'єднано');
      close();
    } catch (err){
      say(readable(err), 'bad');
    }
  };

  el('syncNow').onclick = async () => {
    say('Синхронізую…');
    await engine.syncNow();
    say(engine.state.error || 'Готово', engine.state.error ? 'bad' : 'ok');
  };

  const copy = el('syncCopy');
  if (copy) copy.onclick = async () => {
    const input = el('syncShare');
    input.select();
    try { await navigator.clipboard.writeText(input.value); toast('Посилання скопійовано'); }
    catch { toast('Скопіюйте вручну'); }
  };

  el('syncForget').onclick = () => {
    if (!confirm('Забути налаштування й токен на цьому пристрої?')) return;
    engine.stop();
    clearConfig();
    close();
    toast('Налаштування синхронізації видалено');
  };
}

/** GitHub's own wording is terse; give the common failures a plain sentence. */
function readable(err){
  const status = err && err.status;
  if (status === 401) return 'Токен недійсний або протермінований';
  if (status === 403) return 'Токен не має доступу до цього репозиторію';
  if (status === 404) return 'Репозиторій або файл не знайдено (перевірте owner/repo та права токена)';
  if (status === 409 || status === 422) return 'Хтось зберіг раніше — спробуйте ще раз';
  return String(err && err.message || err);
}
