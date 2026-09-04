/**
 * Connection rendering: the SVG wires, their invisible click targets and the
 * HTML labels that ride on top of them.
 *
 * Wires and labels are registered per connection so a node drag can move just
 * the edges that touch it, without rebuilding the board.
 */

import { S, sel, scene } from '../core/state.js';
import { siblings, tokensAt, blockOnConn } from '../core/model.js';
import { tokenTypeColor } from '../core/constants.js';
import { t } from '../i18n/index.js';
import { esc, safeColor } from '../util/html.js';
import { SIDE_VEC, SIDE_SYM, edgeAt, edgePoint, offsetSegment,
  leaveDirection, curveHandles, curvePath, curveMid } from '../util/geometry.js';
import { nodeSize } from './nodes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** conn.id -> {line, hit, label} */
const registry = new Map();

/** Centre and size of a scene card in world coordinates. */
function anchor(id){
  const s = scene(id);
  if (!s) return null;
  const size = nodeSize(id);
  return { x: s.x + size.w / 2, y: s.y + size.h / 2, w: size.w, h: size.h };
}

/**
 * Endpoints and midpoint of a connection. Sides pinned by the DM win;
 * otherwise the wire aims at the other node. Parallel connections between the
 * same pair are fanned out so they stay distinguishable.
 */
function connMid(c){
  const A = anchor(c.from), B = anchor(c.to);
  if (!A || !B) return null;

  let p = SIDE_VEC[c.fromSide] ? edgeAt(A, SIDE_VEC[c.fromSide]) : edgePoint(A, B);
  let q = SIDE_VEC[c.toSide] ? edgeAt(B, SIDE_VEC[c.toSide]) : edgePoint(B, A);

  const sibs = siblings(c);
  if (sibs.length > 1){
    const i = sibs.findIndex(x => x.id === c.id);
    const spread = (i - (sibs.length - 1) / 2) * 20;
    const n = offsetSegment(p, q, spread);
    if (!SIDE_VEC[c.fromSide]) p = { x: p.x + n.x, y: p.y + n.y };
    if (!SIDE_VEC[c.toSide])   q = { x: q.x + n.x, y: q.y + n.y };
  }

  // Curved rather than straight: with a dozen scenes and passages crossing
  // between them, a straight line is the hardest of the options to follow.
  const dirP = leaveDirection(c.fromSide, p, q);
  const dirQ = leaveDirection(c.toSide, q, p);
  const [c1, c2] = curveHandles(p, q, dirP, dirQ);
  const mid = curveMid(p, c1, c2, q);

  return { x: mid.x, y: mid.y, p, q, d: curvePath(p, c1, c2, q) };
}

/** Arrow glyphs describing which sides a connection is pinned to. */
function sideMark(c){
  const a = SIDE_SYM[c.fromSide] || '', b = SIDE_SYM[c.toSide] || '';
  return (a || b) ? ` <span style="opacity:.7">${a}${a && b ? '·' : ''}${b}</span>` : '';
}

const MARKERS = `<defs>
  <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#54685C"/></marker>
  <marker id="arh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#54BE9B"/></marker>
</defs>`;

export function drawEdges(svg, world){
  registry.clear();
  svg.innerHTML = MARKERS;
  const highlight = sel && sel.kind === 'scene' ? sel.id : null;

  S.connections.forEach(c => {
    const m = connMid(c);
    if (!m) return;

    const hl = highlight && (c.from === highlight || c.to === highlight);
    const isSel = sel && sel.kind === 'conn' && sel.id === c.id;

    const line = document.createElementNS(SVG_NS, 'path');
    setEnds(line, m);
    line.setAttribute('class', 'wire'
      + (c.dir === 'one' ? ' oneway' : '')
      + (c.open === false ? ' shut' : '')
      + (hl ? ' hl' : '')
      + (isSel ? ' sel' : ''));
    if (c.dir === 'one') line.setAttribute('marker-end', hl ? 'url(#arh)' : 'url(#ar)');
    svg.appendChild(line);

    // A fat transparent copy: the visible wire is too thin to click.
    const hit = document.createElementNS(SVG_NS, 'path');
    setEnds(hit, m);
    hit.setAttribute('class', 'hit');
    hit.dataset.conn = c.id;
    svg.appendChild(hit);

    registry.set(c.id, { line, hit, label: null });
  });

  renderEdgeLabels(world);
}

function setEnds(node, m){
  node.setAttribute('d', m.d);
}

function renderEdgeLabels(world){
  world.querySelectorAll('.elabel').forEach(n => n.remove());
  const frag = document.createDocumentFragment();

  S.connections.forEach(c => {
    const m = connMid(c);
    if (!m) return;

    const isSel = sel && sel.kind === 'conn' && sel.id === c.id;
    const toks = tokensAt('conn', c.id);

    const d = document.createElement('div');
    d.className = 'elabel';
    d.style.left = m.x + 'px';
    d.style.top = m.y + 'px';

    const covered = blockOnConn(c.id);
    const blocked = covered && !covered.block.done;

    let html = `<span class="chip clk elab" data-conn="${esc(c.id)}"`
      + ` style="border-color:${isSel ? '#D08A34' : '#3A4941'}"`
      + `${blocked ? ` title="${esc(t('conn.blockedBy', { name: covered.block.nm }))}"` : ''}>`
      + `${c.open === false ? '✕ ' : ''}`
      + `${blocked ? '<i class="blk">⛔</i> ' : ''}`
      + `${esc(c.name)}${sideMark(c)}`
      + `${c.dir === 'one' ? ' →' : ' ↔'}`
      + `${c.minutes ? ` · ${esc(c.minutes)}${esc(t('conn.min'))}` : ''}</span>`;

    if (c.counters.length){
      html += `<span class="erow">` + c.counters.map(k =>
        `<span class="ctr"><b>${esc(k.label)}</b>`
        + `<button data-ctr="c:${esc(c.id)}:${esc(k.id)}:-1">−</button>`
        + `<span class="v">${esc(k.value)}</span>`
        + `<button data-ctr="c:${esc(c.id)}:${esc(k.id)}:1">+</button></span>`).join('') + `</span>`;
    }

    if (toks.length){
      html += `<span class="erow">` + toks.map(tok => {
        const col = safeColor(tok.color || tokenTypeColor(tok.type));
        return `<span class="tok" data-token="${esc(tok.id)}" style="--tc:${col}">`
          + `<i class="dot"></i>${esc(tok.name)}</span>`;
      }).join('') + `</span>`;
    }

    d.innerHTML = html;
    frag.appendChild(d);
    const entry = registry.get(c.id);
    if (entry) entry.label = d;
  });

  world.appendChild(frag);
}

/**
 * Move only the edges attached to one scene. Used while dragging a node, so
 * the board does not have to be rebuilt on every frame.
 */
export function moveEdgesOf(sceneId){
  S.connections.forEach(c => {
    if (c.from !== sceneId && c.to !== sceneId) return;
    const entry = registry.get(c.id);
    if (!entry) return;
    const m = connMid(c);
    if (!m) return;
    if (entry.line) setEnds(entry.line, m);
    if (entry.hit) setEnds(entry.hit, m);
    if (entry.label){
      entry.label.style.left = m.x + 'px';
      entry.label.style.top = m.y + 'px';
    }
  });
}
