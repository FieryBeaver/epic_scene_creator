/**
 * Merging two versions of a board.
 *
 * Pure: takes two documents, returns a third. No state, no DOM, no network —
 * which is what makes the rule below testable, and it is the one rule the
 * whole feature rests on.
 *
 * The rule, per entity id: the side holding the later stamp wins, and a
 * tombstone is just another stamp. Two DMs on different scenes therefore both
 * keep their work; two DMs on the same scene resolve to the later save, for
 * that scene alone.
 */

import { SYNCED, newer, sameStamp } from './protocol.js';

/**
 * @param {object} mine    the local document
 * @param {object} theirs  the document just pulled
 * @returns {{doc: object, changed: string[]}}
 *   changed — entity ids whose local content the merge replaced or removed
 *
 * Whether one of those was an *override* of unsent local work cannot be told
 * from two documents alone — it needs the snapshot they diverged from, which
 * only the engine keeps. See `SyncEngine.pull`.
 */
export function mergeDocs(mine, theirs){
  const myStamps = mine.sync.stamps, myTombs = mine.sync.tombs;
  const theirStamps = theirs.sync.stamps, theirTombs = theirs.sync.tombs;

  const doc = {
    title: pickTitle(mine, theirs),
    sync: {
      clock: Math.max(mine.sync.clock | 0, theirs.sync.clock | 0),
      device: mine.sync.device,
      stamps: {},
      tombs: {},
    },
  };

  const changed = [];

  SYNCED.forEach(collection => {
    const mineById = index(mine[collection]);
    const theirsById = index(theirs[collection]);
    const out = [];
    const seen = new Set();

    // Local order first, so the board does not reshuffle under the DM.
    const order = [...mineById.keys(), ...theirsById.keys()];

    for (const id of order){
      if (seen.has(id)) continue;
      seen.add(id);

      const live = newer(myStamps[id] || null, theirStamps[id] || null);
      const dead = newer(myTombs[id] || null, theirTombs[id] || null);
      const winner = newer(live, dead);

      if (dead && winner === dead && !sameStamp(live, dead)){
        doc.sync.tombs[id] = dead;
        if (mineById.has(id)) changed.push(id);      // deleted elsewhere
        continue;
      }
      if (!live){
        // Never stamped by anyone: keep whatever exists, preferring local.
        const entity = mineById.get(id) || theirsById.get(id);
        if (entity) out.push(entity);
        continue;
      }

      doc.sync.stamps[id] = live;
      const takeTheirs = sameStamp(live, theirStamps[id]) && !sameStamp(live, myStamps[id]);
      const entity = takeTheirs ? theirsById.get(id) : mineById.get(id);
      if (!entity){
        // The winning side does not actually carry the entity: fall back.
        const fallback = mineById.get(id) || theirsById.get(id);
        if (fallback) out.push(fallback);
        continue;
      }
      out.push(entity);

      if (takeTheirs) changed.push(id);
    }

    doc[collection] = out;
  });

  // Tombstones nobody contested still have to travel, or a deletion would be
  // resurrected by the next device that never heard about it.
  carryTombs(doc.sync.tombs, myTombs, doc.sync.stamps);
  carryTombs(doc.sync.tombs, theirTombs, doc.sync.stamps);

  return { doc, changed };
}

function index(list){
  return new Map((list || []).map(e => [e.id, e]));
}

function carryTombs(into, from, stamps){
  for (const [id, stamp] of Object.entries(from || {})){
    if (stamps[id]) continue;
    into[id] = newer(into[id] || null, stamp);
  }
}

/** The title is one field with no stamp of its own; the busier clock wins. */
function pickTitle(mine, theirs){
  return (theirs.sync.clock | 0) > (mine.sync.clock | 0) ? theirs.title : mine.title;
}
