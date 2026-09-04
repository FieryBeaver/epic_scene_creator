/**
 * Inspector entry point: picks the right panel for the current selection and
 * the current mode, and supplies the two "nothing selected" screens.
 */

import { sel, mode, scene, conn, token } from '../../core/state.js';
import { el } from '../../util/dom.js';
import { inspScene } from './scene.js';
import { inspConn } from './connection.js';
import { inspToken, readToken } from './token.js';
import { readScene, readConn } from './readonly.js';

export function renderInsp(){
  const box = el('insp');
  box.innerHTML = panelHtml() || emptyPanel();
}

function panelHtml(){
  if (!sel) return '';
  if (mode === 'view'){
    if (sel.kind === 'scene') return readScene(scene(sel.id));
    if (sel.kind === 'conn') return readConn(conn(sel.id));
    return readToken(token(sel.id));
  }
  if (sel.kind === 'scene') return inspScene(scene(sel.id));
  if (sel.kind === 'conn') return inspConn(conn(sel.id));
  if (sel.kind === 'token') return inspToken(token(sel.id));
  return '';
}

function emptyPanel(){
  return mode === 'view' ? emptyView() : emptyEdit();
}

function emptyView(){
  return `<div class="ihead">
      <div class="t">Режим перегляду</div>
      <div class="s">Нічого не редагується</div>
    </div>
    <div class="ipad">
      <p class="hint">Клікніть сцену на дошці або в списку ліворуч — тут відкриється її повний опис.</p>
      <ul class="tight" style="color:var(--dim);font-size:12px">
        <li>Кожен перехід і кожне посилання на іншу сцену — кнопка. Клік переносить туди.</li>
        <li>«Ця сцена розв'язує» показує, чиї небезпеки й блоки закриваються саме тут.</li>
        <li>Лічильники й перетягування токенів працюють — це стан гри, а не редагування.</li>
        <li>Дошка так само рухається і масштабується.</li>
      </ul>
    </div>`;
}

function emptyEdit(){
  return `<div class="ihead">
      <div class="t">Нічого не вибрано</div>
      <div class="s">Клікніть сцену, з'єднання або токен</div>
    </div>
    <div class="ipad">
      <p class="hint">Швидкий старт:</p>
      <ul class="tight" style="color:var(--dim);font-size:12px">
        <li><b>+ Сцена</b> або подвійний клік по полю — нова сцена.</li>
        <li><b>🔗 З'єднати</b> — потім клік по двох сценах.</li>
        <li>Тягніть заголовок сцени, щоб рухати; колесо — зум; тягніть фон — панорама.</li>
        <li>Токени тягнуться зі сцени на сцену або на з'єднання.</li>
        <li><b>Експорт JSON</b> зберігає все; <b>Імпорт JSON</b> повертає назад.</li>
      </ul>
      <div class="sep"></div>
      <p class="hint">У сцені: локації (▣ кімнати, ◈ кімнати зі скарбом, ⛩ гробниці богів,
        скелетні ключі), небезпеки (☠), блоки (⛔), івенти (⚡) та лічильники.</p>
    </div>`;
}
