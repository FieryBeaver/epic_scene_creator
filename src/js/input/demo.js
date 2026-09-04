/**
 * Demo layout — a twelve-scene dungeon that shows every feature at once:
 * rooms, the nine tombs and five keys placed, treasure, a cross-scene danger,
 * a cross-scene block, an event, and tokens on the board.
 *
 * Handy as a starting skeleton, and as a smoke test after a change.
 */

import { S, uid, setBoard, setSel, blank } from '../core/state.js';
import { newScene, newConn, mkToken } from '../core/model.js';
import { locs, mkLoc, isTreasure } from '../core/locations.js';
import { place } from '../core/registries.js';
import { GODS, KEYS, SCENE_COLORS } from '../core/constants.js';
import { TPL_DANGER, TPL_BLOCK, TPL_EVENT, TPL_TREASURE, TPL_CONN, tplName, tplText }
  from '../core/templates.js';
import { t } from '../i18n/index.js';

const DMS = ['demo.dm1', 'demo.dm2', 'demo.dm3', 'demo.dm4', 'demo.dm5', 'demo.dm6'];

/** Scene key, then the keys of the rooms it starts with. */
const PLAN = [
  ['demo.s1',  ['demo.s1r1', 'demo.s1r2', 'demo.s1r3']],
  ['demo.s2',  ['demo.s2r1', 'demo.s2r2', 'demo.s2r3']],
  ['demo.s3',  ['demo.s3r1', 'demo.s3r2', 'demo.s3r3']],
  ['demo.s4',  ['demo.s4r1', 'demo.s4r2', 'demo.s4r3']],
  ['demo.s5',  ['demo.s5r1', 'demo.s5r2', 'demo.s5r3']],
  ['demo.s6',  ['demo.s6r1', 'demo.s6r2']],
  ['demo.s7',  ['demo.s7r1', 'demo.s7r2']],
  ['demo.s8',  ['demo.s8r1', 'demo.s8r2']],
  ['demo.s9',  ['demo.s9r1', 'demo.s9r2']],
  ['demo.s10', ['demo.s10r1', 'demo.s10r2', 'demo.s10r3']],
  ['demo.s11', ['demo.s11r1', 'demo.s11r2']],
  ['demo.s12', ['demo.s12r1', 'demo.s12r2', 'demo.s12r3']],
];

const COLS = 4;
const COL_W = 340;
const ROW_H = 320;

/** Replace the board with the demo layout. Does not render. */
export function buildDemoBoard(){
  setBoard(blank());
  S.title = t('demo.title');
  setSel(null);

  layoutScenes();
  placeRegistryItems();
  addTreasureRooms();
  connectScenes();
  addCrossSceneExamples();
  addTokens();

  setSel(null);
  return S;
}

function layoutScenes(){
  PLAN.forEach(([name, rooms], i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const s = newScene(80 + col * COL_W, 80 + row * ROW_H, {
      name: t(name), dm: t(DMS[i % DMS.length]), color: SCENE_COLORS[i % SCENE_COLORS.length],
    });
    rooms.forEach(key => locs(s).push(mkLoc({ nm: t(key) })));
  });
}

/** Nine tombs and five keys, spread so no scene holds too much. */
function placeRegistryItems(){
  GODS.forEach((id, i) => place('gods', id, S.scenes[i % S.scenes.length].id));
  KEYS.forEach((k, i) => place('keys', k.id, S.scenes[(i * 2 + 1) % S.scenes.length].id));
}

function addTreasureRooms(){
  TPL_TREASURE.forEach((tpl, i) => {
    const s = S.scenes[(i * 2) % S.scenes.length];
    locs(s).push(mkLoc({
      nm: tplName('treasure', tpl), hasTre: true,
      tre: tplText('treasure', tpl, 'what'), guard: tplText('treasure', tpl, 'guard'),
    }));
  });
}

function link(a, b, name, fromSide, toSide){
  const made = newConn(S.scenes[a].id, S.scenes[b].id);
  if (!made) return null;
  Object.assign(made.conn, { name, fromSide: fromSide || '', toSide: toSide || '', minutes: 1 });
  return made.conn;
}

/** A four-by-three grid wired along the rows and down the columns. */
function connectScenes(){
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < COLS - 1; c++) link(r * COLS + c, r * COLS + c + 1, t('demo.corridor'), 'E', 'W');
  }
  for (let c = 0; c < COLS; c++){
    for (let r = 0; r < 2; r++) link(r * COLS + c, (r + 1) * COLS + c, t('demo.stairsDown'), 'S', 'N');
  }
  link(0, 5, tplName('conn', TPL_CONN[2]), 'SE', 'NW');
  const slit = link(1, 2, tplName('conn', TPL_CONN[1]), 'SE', 'SW');
  if (slit) slit.desc = tplText('conn', TPL_CONN[1], 'desc');
}

/** The point of the board: things in one scene that only another can solve. */
function addCrossSceneExamples(){
  const [s0, , s2, s3] = S.scenes;
  const s6 = S.scenes[6];

  s0.dangers.push({ id: uid('d'), nm: tplName('danger', TPL_DANGER[0]),
                    what: tplText('danger', TPL_DANGER[0], 'what'),
                    fix: tplText('danger', TPL_DANGER[0], 'fix'),
                    lvl: TPL_DANGER[0].lvl, active: true,
                    src: s3.id, srcLoc: locs(s3)[1].id });
  s0.counters.push({ id: uid('n'), label: t('demo.wave'), value: 1 });

  const gold = locs(s6).find(isTreasure) || locs(s6)[0];
  s6.blocks.push({ id: uid('b'), nm: tplName('block', TPL_BLOCK[0]),
                   what: tplText('block', TPL_BLOCK[0], 'what'),
                   key: tplText('block', TPL_BLOCK[0], 'key'),
                   tgtKind: 'loc', tgt: gold.id, tgtText: '',
                   src: s2.id, srcLoc: locs(s2)[0].id, done: false });

  s2.events.push({ id: uid('e'), nm: tplName('event', TPL_EVENT[0]),
                   trig: tplText('event', TPL_EVENT[0], 'trig'),
                   eff: tplText('event', TPL_EVENT[0], 'eff'),
                   conn: '', act: 'open', fired: false });
}

function addTokens(){
  mkToken('party', t('demo.partyA'), { kind: 'scene', id: S.scenes[0].id });
  mkToken('scouts', t('demo.scouts'), { kind: 'scene', id: S.scenes[2].id });
  mkToken('boss', t('demo.boss'), { kind: 'scene', id: S.scenes[4].id });
}
