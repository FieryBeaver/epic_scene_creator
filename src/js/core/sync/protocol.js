/**
 * What travels between devices, and how each piece is versioned.
 *
 * The synced document is the *shared* part of a board: scenes, passages,
 * tokens, registries and the title. Panel widths and the camera stay on the
 * device they belong to — nobody wants another DM's scroll position.
 *
 * Versioning is per top-level entity, not per board. A scene, a passage, a
 * token and a registry each carry a stamp, so two DMs working on different
 * scenes both keep their work. Stamps are assigned by comparing the board
 * against the last synced snapshot rather than by instrumenting every
 * mutation — a call site cannot forget to bump something it never touches.
 */

/** Collections that travel, keyed by the id field their entries use. */
export const SYNCED = ['scenes', 'connections', 'tokens', 'registries'];

/* ============================================================
   Stamps
   ============================================================ */

/**
 * A stamp orders two versions of the same entity:
 *   rev — Lamport counter, so a change that saw an earlier one sorts after it
 *   at  — wall clock, to break ties between devices that never met
 *   dev — device id, so the tie-break is deterministic everywhere
 */
export function newSync(deviceId){
  return { clock: 0, device: deviceId, stamps: {}, tombs: {} };
}

/** Normalise whatever a file carries into a usable sync block. */
export function readSync(raw, deviceId){
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    clock: Number.isFinite(+s.clock) ? Math.trunc(+s.clock) : 0,
    device: deviceId,
    stamps: cleanStamps(s.stamps),
    tombs: cleanStamps(s.tombs),
  };
}

function cleanStamps(map){
  const out = {};
  if (!map || typeof map !== 'object') return out;
  for (const [id, v] of Object.entries(map)){
    if (!Array.isArray(v) || v.length < 3) continue;
    const [rev, at, dev] = v;
    if (!Number.isFinite(+rev)) continue;
    out[id] = [Math.trunc(+rev), Math.trunc(+at) || 0, String(dev || '')];
  }
  return out;
}

/** Later of two stamps. A missing stamp loses to any real one. */
export function newer(a, b){
  if (!a) return b || null;
  if (!b) return a;
  if (a[0] !== b[0]) return a[0] > b[0] ? a : b;
  if (a[1] !== b[1]) return a[1] > b[1] ? a : b;
  return a[2] >= b[2] ? a : b;
}

export function sameStamp(a, b){
  return !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/* ============================================================
   The shared document
   ============================================================ */

/** Strip a board down to what other devices should see. */
export function toDoc(board){
  const doc = { title: board.title, sync: board.sync };
  SYNCED.forEach(k => { doc[k] = board[k] || []; });
  return doc;
}

/** Put a merged document back onto a board, leaving local-only fields alone. */
export function applyDoc(board, doc){
  board.title = doc.title;
  board.sync = doc.sync;
  SYNCED.forEach(k => { board[k] = doc[k] || []; });
  return board;
}

/* ============================================================
   Stamping by comparison
   ============================================================ */

const byId = list => new Map((list || []).map(e => [e.id, e]));

/**
 * Compare the board against the snapshot it was built from and stamp
 * everything that actually changed. Returns true if anything did.
 *
 * @param {object} board     the live board (mutated: its sync block is updated)
 * @param {object|null} base the last synced document, or null for a first push
 * @param {number} now       injectable clock, for tests
 */
export function stampChanges(board, base, now = Date.now()){
  const sync = board.sync;
  const before = sync.clock;

  SYNCED.forEach(collection => {
    const live = byId(board[collection]);
    const old = byId(base ? base[collection] : []);

    for (const [id, entity] of live){
      const previous = old.get(id);
      if (previous && same(entity, previous)) continue;
      if (!previous && sync.stamps[id] && !base) continue;  // first push keeps stamps
      sync.stamps[id] = [++sync.clock, now, sync.device];
      delete sync.tombs[id];
    }

    for (const id of old.keys()){
      if (live.has(id)) continue;
      sync.tombs[id] = [++sync.clock, now, sync.device];
      delete sync.stamps[id];
    }
  });

  // Anything never stamped (a board made before sync existed) gets one now.
  SYNCED.forEach(collection => {
    (board[collection] || []).forEach(e => {
      if (!sync.stamps[e.id]) sync.stamps[e.id] = [++sync.clock, now, sync.device];
    });
  });

  return sync.clock !== before;
}

/** Structural equality, good enough for plain board data. */
export function same(a, b){
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}
