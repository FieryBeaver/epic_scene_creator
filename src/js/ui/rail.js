/**
 * Left rail: a tab per list. Scenes and tokens are fixed; every registry the
 * DM defines gets a tab of its own, created and removed as needed.
 */

import { S, sel, regs, reg } from '../core/state.js';
import { tokenHost } from '../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor } from '../core/locations.js';
import { hostOf } from '../core/registries.js';
import { TOKTYPE } from '../core/constants.js';
import { TPL_BOSS } from '../core/templates.js';
import { esc, safeColor } from '../util/html.js';
import { el } from '../util/dom.js';
import { sceneOptions } from './inspector/shared.js';

let tab = 'scenes';

export function setTab(name){
  tab = name;
  showTab();
}

export function getTab(){
  return tab;
}

export function renderRail(){
  renderTabs();
  renderPaneScenes();
  renderPaneTokens();
  renderRegPanes();
  showTab();
}

function renderTabs(){
  el('tabs').innerHTML =
    `<button data-p="scenes">Сцени</button><button data-p="tokens">Токени</button>`
    + regs().map(r => `<button data-p="reg-${esc(r.id)}">${esc(r.sym || '')} ${esc(r.nm)}</button>`).join('')
    + `<button class="plus eonly" data-addreg title="Новий список локацій">＋</button>`;
}

function showTab(){
  // A registry tab can disappear while it is open.
  if (tab.startsWith('reg-') && !reg(tab.slice(4))) tab = 'scenes';
  document.querySelectorAll('#tabs button[data-p]')
    .forEach(b => b.classList.toggle('on', b.dataset.p === tab));
  document.querySelectorAll('.pane')
    .forEach(p => p.classList.toggle('on', p.id === 'p-' + tab));
}

/* ---------- scenes ---------- */

export function renderPaneScenes(){
  let h = `<h3>Сцени · ${S.scenes.length}</h3>`;
  if (!S.scenes.length){
    h += `<p class="hint">Ще немає сцен. Натисніть «+ Сцена» або «Демо-розкладка».</p>`;
  }

  S.scenes.forEach(s => {
    const active = sel && sel.kind === 'scene' && sel.id === s.id;
    const dangers = s.dangers.filter(d => d.active !== false).length;
    const blocks = s.blocks.filter(b => !b.done).length;
    const treasure = locs(s).filter(l => isTreasure(l) && !l.taken).length;
    const rooms = locs(s).length;

    h += `<div class="card ${active ? 'act' : ''}" data-goto="${esc(s.id)}" tabindex="0"
        style="border-left:3px solid ${safeColor(s.color, '#54685C')}">
      <div class="cn">${esc(s.name)}</div>
      <div class="cs">${s.dm ? esc(s.dm) + ' · ' : ''}☠ ${dangers} · ◈ ${treasure} · ⛔ ${blocks}`
      + `${rooms ? ' · ▣ ' + rooms : ''}</div>
      ${rooms ? `<div class="tagline">${locs(s).map(l =>
        `<span class="tag" style="color:${safeColor(locColor(l))}">${locIcon(l)} ${esc(locName(l))}</span>`
      ).join('')}</div>` : ''}
    </div>`;
  });

  el('p-scenes').innerHTML = h;
}

/* ---------- tokens ---------- */

export function renderPaneTokens(){
  let h = `<h3>Токени · ${S.tokens.length}</h3>
    <p class="hint">Боси, що прорвались крізь Ворота, розвідгрупи, союзники, партії гравців.</p>
    <div class="row eonly" style="margin-bottom:8px">
      <button class="btn sm" data-newtok="boss">+ Бос</button>
      <button class="btn sm" data-newtok="scouts">+ Розвідка</button>
      <button class="btn sm" data-newtok="ally">+ Союзник</button>
      <button class="btn sm" data-newtok="party">+ Група</button>
    </div>
    <label class="f eonly"><span>Швидко: бос із хвилі Воріт</span>
      <select data-boss-tpl>
        <option value="">— обрати —</option>
        ${TPL_BOSS.map(b => `<option>${esc(b)}</option>`).join('')}
      </select></label>
    <div class="sep"></div>`;

  if (!S.tokens.length) h += `<p class="hint">Токенів немає.</p>`;

  S.tokens.forEach(t => {
    const host = tokenHost(t);
    const c = safeColor(t.color || (TOKTYPE[t.type] || TOKTYPE.other).c);
    h += `<div class="card" style="border-left:3px solid ${c}">
      <div class="cn">${esc(t.name)}</div>
      <div class="cs">${esc((TOKTYPE[t.type] || TOKTYPE.other).nm)}${t.hp ? ' · ' + esc(t.hp) : ''}</div>
      <div style="margin-top:4px">${host
        ? (t.at.kind === 'scene'
            ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
            : `<button class="linkbtn" data-selconn="${esc(host.id)}">на «${esc(host.name)}»</button>`)
        : `<span class="empty">поза дошкою</span>`}
        <button class="btn sm" data-seltoken="${esc(t.id)}" style="float:right">ред.</button></div>
    </div>`;
  });

  el('p-tokens').innerHTML = h;
}

/* ---------- registries ---------- */

function renderRegPanes(){
  const box = el('panes');
  const wanted = new Set(regs().map(r => 'p-reg-' + r.id));
  box.querySelectorAll('.pane[id^="p-reg-"]').forEach(pane => {
    if (!wanted.has(pane.id)) pane.remove();
  });

  regs().forEach(r => {
    let pane = document.getElementById('p-reg-' + r.id);
    if (!pane){
      pane = document.createElement('section');
      pane.className = 'pane';
      pane.id = 'p-reg-' + r.id;
      box.appendChild(pane);
    }
    pane.innerHTML = regPaneHtml(r);
  });
}

function regPaneHtml(r){
  const placed = r.items.filter(it => hostOf(r.id, it.id)).length;
  const id = esc(r.id);

  let h = `<h3>${esc(r.sym || '')} ${esc(r.nm)} · ${placed}/${r.items.length}</h3>
    <p class="hint">Кожен елемент лежить рівно в одній кімнаті. Клік по сцені — перехід на дошку.</p>
    <div class="eonly" style="border:1px solid var(--line);border-radius:5px;padding:7px;margin-bottom:9px">
      <div class="grid2">
        <label class="f"><span>Назва списку</span>
          <input type="text" data-path="r:${id}:nm" value="${esc(r.nm)}"></label>
        <label class="f"><span>Значок</span>
          <input type="text" data-path="r:${id}:sym" value="${esc(r.sym || '')}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Як звати кімнату</span>
          <input type="text" placeholder="${esc(r.nm)}" data-path="r:${id}:one" value="${esc(r.one || '')}"></label>
        <label class="f"><span>Колір</span>
          <input type="color" data-path="r:${id}:color" value="${esc(safeColor(r.color))}"></label>
      </div>
      <button class="x" data-delreg="${id}">Видалити список</button>
    </div>`;

  if (!r.items.length) h += `<p class="hint">Список порожній.</p>`;

  r.items.forEach(it => {
    const host = hostOf(r.id, it.id);
    const p = `r:${id}:items:${esc(it.id)}`;
    h += `<div class="card" style="border-left:3px solid ${safeColor(r.color, '#54685C')}">
      <div class="cn">${it.sym || r.sym || '◆'} ${esc(it.nm)}</div>
      ${it.note ? `<div class="cs">${esc(it.note)}</div>` : ''}
      <div class="eonly grid2" style="margin-top:5px">
        <input type="text" placeholder="назва" data-path="${p}:nm" value="${esc(it.nm)}">
        <input type="text" placeholder="значок" data-path="${p}:sym" value="${esc(it.sym || '')}">
      </div>
      <input class="eonly" type="text" style="margin-top:4px" placeholder="нотатка"
        data-path="${p}:note" value="${esc(it.note || '')}">
      <div style="margin-top:5px">${host
        ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
        : `<span class="empty">не призначено</span>`}</div>
      <div class="eonly row" style="margin-top:5px">
        <select style="flex:1" data-setitem="${id}:${esc(it.id)}">
          <option value="">— обрати сцену —</option>${sceneOptions(host ? host.id : '', false)}</select>
        <button class="x" data-delitem="${id}:${esc(it.id)}">✕</button>
      </div>
    </div>`;
  });

  return h + `<button class="btn sm eonly" data-additem="${id}">+ елемент</button>`;
}
