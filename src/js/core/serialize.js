/**
 * Board file format: read and write.
 *
 * Pure functions — no DOM, no global state — so the migration path can be
 * tested headlessly (see `test/serialize.test.mjs`). The caller installs the
 * result with `setBoard()`.
 *
 * The reader is deliberately forgiving: it accepts boards written by older
 * versions of the app and normalises every field, because a board file is
 * hand-editable and arrives from disk as untrusted input.
 */

import { BOARD_APP, BOARD_VERSION } from './state.js';
import { defaultRegistries } from './constants.js';
import { readSync } from './sync/protocol.js';
import { deviceId } from './sync/config.js';

/* ============================================================
   Write
   ============================================================ */

/**
 * Snapshot of the board plus the viewport, ready for `JSON.stringify`.
 * @param {object} board  the current board
 * @param {{x:number,y:number,z:number}} camera
 */
export function serialize(board, camera){
  const data = JSON.parse(JSON.stringify(board));
  data.app = BOARD_APP;
  data.version = BOARD_VERSION;
  data.camera = { x: camera.x, y: camera.y, z: camera.z };
  data.ui = board.ui || {};
  data.exportedAt = new Date().toISOString();
  return data;
}

/** Filename for an export, stamped with the current time. */
export function exportFilename(now = new Date()){
  return 'dungeon-board-' + now.toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
}

/* ============================================================
   Read
   ============================================================ */

const str = (v, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const int = v => (Number.isFinite(+v) ? Math.trunc(+v) : 0);

/** Old `tgtKind` values, from before blocks could point at rooms directly. */
const LEGACY_BLOCK_KINDS = {
  'скарб': 'loc', 'кімнату': 'loc', 'гробницю': 'loc', 'прохід': 'conn',
  treasure: 'loc', god: 'loc', toa: 'loc',
};

/**
 * Parse a board file into a fresh board object.
 * @throws {Error} when the payload is not a board.
 */
export function deserialize(raw){
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)){
    throw new Error('це не файл дошки (немає масиву scenes)');
  }

  // Local id factory: never touches the live board's counter.
  let seq = int(raw.seq) || 1;
  const uid = p => p + (seq++) + Math.random().toString(36).slice(2, 5);

  const board = {
    app: BOARD_APP,
    version: BOARD_VERSION,
    title: str(raw.title, 'Друга фаза — дослідження підземелля'),
    scenes: [],
    connections: [],
    tokens: [],
    registries: readRegistries(raw.registries, uid),
    ui: raw.ui && typeof raw.ui === 'object' ? raw.ui : {},
    sync: readSync(raw.sync, deviceId()),
    seq,
  };

  board.scenes = raw.scenes.map(s => readScene(s, uid));
  relinkLegacyBlocks(board.scenes);
  foldRegistryRooms(board.scenes, board.registries, uid);

  const known = new Set(board.scenes.map(s => s.id));
  board.connections = (raw.connections || [])
    .map(c => readConn(c, uid))
    .filter(c => known.has(c.from) && known.has(c.to));

  // A token may name a scene or connection that the file no longer contains;
  // such a token stays on the board but off the map.
  const places = new Set([...known, ...board.connections.map(c => c.id)]);
  board.tokens = (raw.tokens || []).map(t => readToken(t, uid));
  board.tokens.forEach(t => { if (t.at && !places.has(t.at.id)) t.at = null; });

  // Keep the counter ahead of every id already in the file, so a board that
  // was hand-merged cannot hand out an id twice.
  const highest = [...board.scenes, ...board.connections, ...board.tokens]
    .reduce((m, o) => Math.max(m, parseInt(String(o.id).replace(/^\D+/, ''), 10) || 0), 0);
  board.seq = Math.max(seq, highest + 1);

  return board;
}

function readRegistries(list, uid){
  if (!Array.isArray(list) || !list.length) return defaultRegistries();
  return list.map(r => ({
    id: str(r.id) || uid('g'),
    nm: str(r.nm, 'Список'),
    one: str(r.one),
    sym: str(r.sym, '◆'),
    color: str(r.color, '#C7D6E0'),
    items: (r.items || []).map(it => ({
      id: str(it.id) || uid('i'),
      nm: str(it.nm),
      sym: str(it.sym),
      note: str(it.note),
      desc: str(it.desc),      // v4: the description of the room this item is
    })),
  }));
}

function readScene(s, uid){
  return {
    id: str(s.id) || uid('s'),
    name: str(s.name, 'Сцена'),
    dm: str(s.dm),
    color: str(s.color, '#54685C'),
    x: int(s.x), y: int(s.y),
    notes: str(s.notes),

    dangers: (s.dangers || []).map(x => ({
      id: str(x.id) || uid('d'),
      nm: str(x.nm), what: str(x.what), fix: str(x.fix),
      lvl: Math.min(4, Math.max(1, int(x.lvl) || 1)),
      active: x.active !== false,
      src: str(x.src), srcLoc: str(x.srcLoc),
    })),

    blocks: (s.blocks || []).map(x => {
      const legacyKind = str(x.tgtKind) || str(x.kind);
      return {
        id: str(x.id) || uid('b'),
        nm: str(x.nm), what: str(x.what), key: str(x.key),
        tgtKind: LEGACY_BLOCK_KINDS[legacyKind] || str(x.tgtKind) || 'conn',
        tgt: str(x.tgt), tgtText: str(x.tgtText),
        src: str(x.src), srcLoc: str(x.srcLoc),
        done: !!x.done,
        _legacyKind: legacyKind,
      };
    }),

    events: (s.events || []).map(x => ({
      id: str(x.id) || uid('e'),
      nm: str(x.nm, 'Івент'), trig: str(x.trig), eff: str(x.eff),
      conn: str(x.conn),
      act: x.act === 'close' ? 'close' : 'open',
      fired: !!x.fired,
    })),

    locations: readLocations(s, uid),

    counters: (s.counters || []).map(x => ({
      id: str(x.id) || uid('n'),
      label: str(x.label, 'лічильник'),
      value: int(x.value),
    })),
  };
}

/**
 * Rooms, folding in the two pre-v3 shapes:
 *   - `scene.gods` / `scene.keys`: bare id lists, one room each;
 *   - `scene.treasures`: standalone treasures, now rooms with `hasTre`.
 */
function readLocations(s, uid){
  const source = s.locations || [
    ...(s.gods || []).map(g => ({ kind: 'god', ref: g })),
    ...(s.keys || []).map(k => ({ kind: 'key', ref: k })),
  ];

  const legacyTreasures = (s.treasures || []).map(t => ({
    kind: 'treasure', nm: str(t.nm, 'Скарб'), notes: '',
    tre: str(t.what), guard: str(t.guard), taken: !!t.done,
    _oldId: str(t.id), _oldBlock: str(t.block),
  }));

  return [...source, ...legacyTreasures].map(l => {
    const reg = Object.assign({},
      l.reg && typeof l.reg === 'object' ? l.reg : null,
      (l.god || l.kind === 'god') ? { gods: l.god || l.ref || '' } : null,
      (l.key || l.kind === 'key') ? { keys: l.key || l.ref || '' } : null);
    Object.keys(reg).forEach(k => { if (!reg[k]) delete reg[k]; });

    return {
      id: str(l.id) || uid('l'),
      nm: str(l.nm), notes: str(l.notes),
      reg,
      hasTre: l.hasTre != null ? !!l.hasTre : l.kind === 'treasure',
      tre: str(l.tre), guard: str(l.guard), taken: !!l.taken,
      links: (l.links || []).map(k => ({
        id: str(k.id) || uid('k'), label: str(k.label), url: str(k.url),
      })),
      _oldId: str(l._oldId), _oldBlock: str(l._oldBlock),
    };
  });
}

/**
 * Point pre-v3 blocks at the rooms their targets became, then strip the
 * bookkeeping fields the migration needed.
 */
function relinkLegacyBlocks(scenes){
  scenes.forEach(s => {
    const byOldId = {};
    s.locations.forEach(l => { if (l._oldId) byOldId[l._oldId] = l.id; });

    s.blocks.forEach(b => {
      if (b._legacyKind === 'treasure' && byOldId[b.tgt]){
        b.tgt = byOldId[b.tgt];
      } else if (b._legacyKind === 'god'){
        const l = s.locations.find(x => x.reg.gods === b.tgt);
        b.tgt = l ? l.id : '';
      } else if (b._legacyKind === 'toa' || b._legacyKind === 'кімнату'){
        b.tgt = '';
      }
      delete b._legacyKind;
    });

    s.locations.forEach(l => {
      if (l._oldBlock){
        const b = s.blocks.find(x => x.id === l._oldBlock);
        if (b && !b.tgt){ b.tgtKind = 'loc'; b.tgt = l.id; }
      }
      delete l._oldId;
      delete l._oldBlock;
    });
  });
}

/**
 * v3 → v4: make every registry item a room of its own.
 *
 * v3 let a room hold one entry per registry, so a single room could be a
 * tomb *and* a key *and* a treasure vault, and every room in the form showed
 * a dropdown for every list whether or not it had anything to do with it.
 * A tomb is a room; that is all it is.
 *
 * Three things to put right in an old file:
 *   - a room carrying several registry entries becomes several rooms;
 *   - a description written on such a room moves onto the list item, which is
 *     where v4 keeps it;
 *   - an item that somehow ended up in two rooms stays in the first, since
 *     the whole point of a list is that each entry is somewhere definite.
 */
function foldRegistryRooms(scenes, registries, uid){
  const itemsById = new Map();
  registries.forEach(r => r.items.forEach(it => itemsById.set(r.id + '/' + it.id, it)));
  const placed = new Set();

  scenes.forEach(scene => {
    const extra = [];

    scene.locations.forEach(room => {
      const entries = Object.entries(room.reg || {})
        .filter(([regId, itemId]) => itemId && itemsById.has(regId + '/' + itemId));

      // Drop a duplicate placement rather than showing the same tomb twice.
      const fresh = entries.filter(([regId, itemId]) => {
        const key = regId + '/' + itemId;
        if (placed.has(key)) return false;
        placed.add(key);
        return true;
      });

      room.reg = {};
      if (!fresh.length) return;

      const [[keepReg, keepItem], ...rest] = fresh;
      room.reg = { [keepReg]: keepItem };
      moveDescription(room, itemsById.get(keepReg + '/' + keepItem));

      // Everything else this room used to be becomes a room next to it.
      rest.forEach(([regId, itemId]) => {
        extra.push({
          id: uid('l'), nm: '', notes: '', reg: { [regId]: itemId },
          hasTre: false, tre: '', guard: '', taken: false, links: [],
        });
      });
    });

    scene.locations.push(...extra);
  });
}

function moveDescription(room, item){
  if (!item || !room.notes) return;
  if (!item.desc) item.desc = room.notes;
  room.notes = '';
}

function readConn(c, uid){
  return {
    id: str(c.id) || uid('c'),
    from: str(c.from), to: str(c.to),
    name: str(c.name, "З'єднання"),
    dir: c.dir === 'one' ? 'one' : 'two',
    fromSide: str(c.fromSide), toSide: str(c.toSide),
    desc: str(c.desc),
    minutes: c.minutes == null ? 1 : int(c.minutes),
    open: c.open !== false,
    counters: (c.counters || []).map(x => ({
      id: str(x.id) || uid('n'),
      label: str(x.label, 'проходів'),
      value: int(x.value),
    })),
  };
}

function readToken(t, uid){
  return {
    id: str(t.id) || uid('t'),
    name: str(t.name, 'Токен'),
    type: str(t.type, 'other'),
    color: str(t.color),
    hp: str(t.hp),
    notes: str(t.notes),
    at: t.at && t.at.id ? { kind: t.at.kind === 'conn' ? 'conn' : 'scene', id: str(t.at.id) } : null,
  };
}
