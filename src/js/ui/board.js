/**
 * The board: one card per scene, showing at a glance what the DM running it
 * needs — who runs it, how dangerous it is, what is still locked, which
 * rooms it has and who is standing in it.
 */

import { S, sel, marked } from '../core/state.js';
import { neighborsOf, owedBy, tokensAt } from '../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor, locDesc } from '../core/locations.js';
import { TOKTYPE, dangerColor } from '../core/constants.js';
import { esc, safeColor } from '../util/html.js';
import { el } from '../util/dom.js';
import { measureNodes } from './nodes.js';
import { drawEdges } from './edges.js';
import { scheduleDraw } from './minimap.js';

export function renderBoard(){
  const world = el('world');
  const svg = el('edges');

  world.querySelectorAll('.node').forEach(n => n.remove());

  const frag = document.createDocumentFragment();
  // When a scene is selected, everything further than one hop away fades.
  const neighbours = sel && sel.kind === 'scene' ? neighborsOf(sel.id) : null;

  S.scenes.forEach(s => {
    const node = document.createElement('div');
    node.className = 'node';
    node.dataset.scene = s.id;
    node.style.setProperty('--nc', safeColor(s.color, '#54685C'));
    node.style.left = s.x + 'px';
    node.style.top = s.y + 'px';
    if (sel && sel.kind === 'scene' && sel.id === s.id) node.classList.add('sel');
    if (marked.size > 1 && marked.has(s.id)) node.classList.add('marked');
    if (s.collapsed) node.classList.add('folded');
    if (neighbours && !neighbours.has(s.id) && sel.id !== s.id) node.classList.add('dim');
    node.innerHTML = nodeMarkup(s);
    frag.appendChild(node);
  });

  world.appendChild(frag);
  measureNodes(world);
  drawEdges(svg, world);
  scheduleDraw();
}

/** The chips that still matter when the card is folded shut. */
function collapsedSummary(s){
  const dangers = s.dangers.filter(x => x.active !== false).length;
  const blocks = s.blocks.filter(x => !x.done).length;
  const rooms = locs(s).length;
  const toks = tokensAt('scene', s.id).length;
  return `<div class="fold-sum">`
    + `<span title="Активні небезпеки">☠ ${dangers}</span>`
    + `<span title="Нерозв'язані блоки">⛔ ${blocks}</span>`
    + `<span title="Кімнати">▣ ${rooms}</span>`
    + (toks ? `<span title="Токени">◉ ${toks}</span>` : '')
    + `</div>`;
}

function nodeMarkup(s){
  const activeDangers = s.dangers.filter(x => x.active !== false);
  const openBlocks = s.blocks.filter(x => !x.done);
  const treasures = locs(s).filter(isTreasure);
  const unlooted = treasures.filter(x => !x.taken);
  const worstDanger = activeDangers.reduce((m, x) => Math.max(m, x.lvl || 1), 0);
  const toks = tokensAt('scene', s.id);

  let h = `<div class="head">`
    + `<button class="fold" data-fold="${esc(s.id)}"`
    + ` title="${s.collapsed ? 'Розгорнути' : 'Згорнути'} (c)"`
    + ` aria-expanded="${s.collapsed ? 'false' : 'true'}">${s.collapsed ? '▸' : '▾'}</button>`
    + `<div class="nm">${esc(s.name)}</div>`
    + `<div class="dm">${s.dm ? 'ДМ: ' + esc(s.dm) : 'ДМ не вказано'}</div>`
    + `</div>`;

  // Collapsed: the header and the counts, nothing else. Enough to read the
  // shape of a big dungeon at one zoom level.
  if (s.collapsed) return h + collapsedSummary(s);

  h += `<div class="body">`;

  /* summary chips */
  const dgStyle = worstDanger
    ? `border-color:${dangerColor(worstDanger)};color:${dangerColor(worstDanger)}` : '';
  h += `<div class="row">`
    + `<span class="chip dg" title="Активні небезпеки" style="${dgStyle}">☠ ${activeDangers.length}</span>`
    + `<span class="chip tr" title="Не забрані скарби">◈ ${unlooted.length}/${treasures.length}</span>`
    + `<span class="chip bk" title="Нерозв'язані блоки">⛔ ${openBlocks.length}/${s.blocks.length}</span>`;

  const pending = (s.events || []).filter(e => !e.fired);
  if (pending.length){
    h += `<span class="chip ev" title="Івенти, які ще не спрацювали: `
      + `${esc(pending.map(e => e.nm).join('; '))}">⚡ ${pending.length}</span>`;
  }

  const owed = owedBy(s.id);
  if (owed.length){
    h += `<span class="chip owe" title="Тут лежать рішення для інших сцен: `
      + `${esc(owed.map(o => o.from.name + ' → ' + o.it.nm).join('; '))}">↩ ${owed.length}</span>`;
  }
  h += `</div>`;

  /* rooms */
  if (locs(s).length){
    h += `<div class="row">` + locs(s).map(l => {
      const col = safeColor(locColor(l));
      // A room that holds someone else's answer is marked, so the card shows
      // it without the DM having to open the scene.
      const answers = owed.filter(o => o.it.srcLoc === l.id);
      const tip = [
        locDesc(l) || 'кімната',
        ...answers.map(o => `↩ рішення для «${o.it.nm}» (${o.from.name})`),
      ].join(' · ');
      return `<span class="chip clk" data-room="${esc(s.id)}:${esc(l.id)}"`
        + ` style="color:${col};border-color:${col}55;background:${col}14"`
        + ` title="${esc(tip)}">${esc(locIcon(l))} ${esc(locName(l))}`
        + `${answers.length ? ' ↩' : ''}</span>`;
    }).join('') + `</div>`;
  }

  /* counters */
  if (s.counters.length){
    h += `<div class="row">` + s.counters.map(c =>
      `<span class="ctr"><b>${esc(c.label)}</b>`
      + `<button data-ctr="s:${esc(s.id)}:${esc(c.id)}:-1">−</button>`
      + `<span class="v">${esc(c.value)}</span>`
      + `<button data-ctr="s:${esc(s.id)}:${esc(c.id)}:1">+</button></span>`).join('') + `</div>`;
  }

  /* tokens standing here */
  if (toks.length){
    h += `<div class="tokrow">` + toks.map(t => {
      const col = safeColor(t.color || (TOKTYPE[t.type] || TOKTYPE.other).c);
      const hp = t.hp != null && t.hp !== '' ? ' · ' + esc(t.hp) : '';
      return `<span class="tok" data-token="${esc(t.id)}" style="--tc:${col}">`
        + `<i class="dot"></i>${esc(t.name)}${hp}</span>`;
    }).join('') + `</div>`;
  }

  h += `</div><div class="foot eonly">`
    + `<button class="mini" data-act="link" data-id="${esc(s.id)}">з'єднати</button>`
    + `</div>`;

  return h;
}
