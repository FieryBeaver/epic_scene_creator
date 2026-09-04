/**
 * Keyboard reference.
 *
 * The board grew enough shortcuts that they need somewhere to be listed —
 * standard practice is a cheat sheet on `?`, discoverable from the menu so
 * nobody has to already know the shortcut for the shortcut list.
 */

import { esc } from '../util/html.js';
import { el } from '../util/dom.js';

const GROUPS = [
  ['Дошка', [
    ['Колесо', 'Зум до курсора'],
    ['Тягнути фон', 'Панорама'],
    ['Shift + тягнути', 'Рамка виділення'],
    ['Shift / Ctrl + клік', 'Додати сцену до виділення'],
    ['f', 'Вмістити все'],
    ['m', 'Мінікарта'],
    ['v', 'Режим перегляду / редагування'],
  ]],
  ['Сцени', [
    ['n', 'Нова сцена в центрі'],
    ['Подвійний клік', 'Нова сцена в цьому місці'],
    ['Тягнути заголовок', 'Пересунути (виділені — разом)'],
    ['Стрілки', 'Посунути на крок сітки'],
    ['Shift + стрілки', 'Посунути на п’ять кроків'],
    ['Ctrl + D', 'Дублювати виділені'],
    ['c', 'Згорнути / розгорнути картку'],
    ['Delete', 'Видалити виділене'],
  ]],
  ['Інше', [
    ['Esc', 'Скасувати з’єднання, зняти виділення'],
    ['?', 'Ця довідка'],
    ['Подвійний клік по межі панелі', 'Згорнути панель'],
  ]],
];

export function initShortcuts(){
  const box = el('helpModal');
  box.addEventListener('click', ev => {
    if (ev.target === box || ev.target.closest('[data-help-close]')) hideShortcuts();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !box.hidden){ ev.stopPropagation(); hideShortcuts(); }
  }, true);
}

export function showShortcuts(){
  const box = el('helpModal');
  box.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
    <header>
      <h2 id="helpTitle">Гарячі клавіші</h2>
      <button class="btn sm" data-help-close>✕</button>
    </header>
    <div class="body">
      ${GROUPS.map(([title, rows]) => `<div class="keys">
        <h4>${esc(title)}</h4>
        ${rows.map(([k, what]) =>
          `<div class="krow"><kbd>${esc(k)}</kbd><span>${esc(what)}</span></div>`).join('')}
      </div>`).join('')}
    </div>
  </div>`;
  box.hidden = false;
  const close = box.querySelector('[data-help-close]');
  if (close) close.focus();
}

export function hideShortcuts(){
  const box = el('helpModal');
  box.hidden = true;
  box.innerHTML = '';
}

export function toggleShortcuts(){
  el('helpModal').hidden ? showShortcuts() : hideShortcuts();
}
