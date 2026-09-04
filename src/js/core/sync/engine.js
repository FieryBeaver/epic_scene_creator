/**
 * The sync loop.
 *
 * Pull on a timer, push shortly after a local change, merge whenever the two
 * disagree. Everything interesting happens in `merge.js`; this module is the
 * scheduling and error handling around it.
 *
 * Three details worth knowing:
 *
 *  - Polls are conditional. A 304 costs no rate limit at all, so checking
 *    every few seconds during a session is affordable.
 *  - A push is rejected by GitHub when someone else saved first. That is the
 *    signal to pull, merge and try once more — not an error to show.
 *  - The board keeps working with no network. Edits pile up locally and go
 *    out when the next push succeeds.
 */

import { S } from '../state.js';
import { toDoc, applyDoc, stampChanges, readSync, SYNCED, same } from './protocol.js';
import { mergeDocs } from './merge.js';
import { GitHubFile, isConflict } from './github.js';

const POLL_ACTIVE = 5000;      // tab in front
const POLL_HIDDEN = 30000;     // tab in the background
const PUSH_DELAY = 1500;       // quiet period before a save
const BACKOFF_MAX = 60000;

export class SyncEngine {
  /**
   * @param {object} opts
   * @param {() => object} opts.getBoard      the live board
   * @param {(ids:string[]) => void} opts.onRemote  merged changes arrived
   * @param {(state:object) => void} opts.onStatus  status for the UI
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {() => number} [opts.now]  injectable clock; stamp ordering depends
   *   on it, so tests need to drive it rather than race the millisecond
   */
  constructor(opts){
    this.getBoard = opts.getBoard || (() => S);
    this.onRemote = opts.onRemote || (() => {});
    this.onStatus = opts.onStatus || (() => {});
    this.fetchImpl = opts.fetchImpl;
    this.now = opts.now || Date.now;

    this.file = null;
    // Two different snapshots, easy to confuse and wrong when merged:
    this.stamped = null;       // the board as of the last time stamps were assigned
    this.remote = null;        // the document the server is holding, as we last saw it
    this.running = false;
    this.busy = false;
    this.pushWanted = false;
    this.pollTimer = 0;
    this.pushTimer = 0;
    this.backoff = 0;
    this.state = { phase: 'off', at: null, error: '', rate: null };
  }

  /* ---------- lifecycle ---------- */

  async start(cfg){
    this.stop();
    this.file = new GitHubFile(cfg, this.fetchImpl);
    this.running = true;
    this.stamped = null;
    this.remote = null;
    this.set('connecting');
    await this.cycle({ initial: true });
    this.schedulePoll();
  }

  stop(){
    this.running = false;
    clearTimeout(this.pollTimer);
    clearTimeout(this.pushTimer);
    this.pollTimer = this.pushTimer = 0;
    this.file = null;
    this.set('off');
  }

  /** Called after any local edit. */
  nudge(){
    if (!this.running) return;
    this.pushWanted = true;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.cycle(), PUSH_DELAY);
  }

  /** Pull and push right now, whatever the timers say. */
  async syncNow(){
    if (!this.running) return;
    this.pushWanted = true;
    await this.cycle();
  }

  /* ---------- the cycle ---------- */

  async cycle(opts = {}){
    if (!this.running || !this.file) return;
    if (this.busy){ this.pushWanted = this.pushWanted || !!opts.push; return; }
    this.busy = true;
    const wantPush = this.pushWanted;
    this.pushWanted = false;

    try {
      await this.pull();
      if (wantPush || opts.initial) await this.push(opts.initial);
      this.backoff = 0;
      this.set('synced');
    } catch (err){
      this.pushWanted = this.pushWanted || wantPush;   // do not drop the save
      this.fail(err);
    } finally {
      this.busy = false;
      if (this.running) this.schedulePoll();
    }
  }

  async pull(){
    const res = await this.file.read();
    if (res.status === 'unchanged') return false;

    if (res.status === 'absent'){
      // Nothing there yet: this device seeds the file on the next push.
      this.remote = null;
      return false;
    }

    const board = this.getBoard();
    const remote = normaliseDoc(res.data, board.sync.device);
    const changed = this.absorb(board, remote, this.remote);
    this.remote = clone(remote);
    return changed;
  }

  /**
   * Fold a freshly read document into the board: stamp whatever this device
   * changed since it last stamped, merge, and report what came from elsewhere.
   *
   * @param {object|null} lastAgreed  the document as we last knew the server
   *   to hold it. That, not the merge result, is what says whether a change
   *   the merge discarded was actually ours.
   */
  absorb(board, remote, lastAgreed){
    stampChanges(board, this.stamped, this.now());
    const mine = clone(toDoc(board));

    const { doc, changed } = mergeDocs(toDoc(board), remote);
    applyDoc(board, doc);
    this.stamped = clone(toDoc(board));

    if (changed.length) this.onRemote(changed, overridden(lastAgreed, mine, doc, changed));
    return changed.length > 0;
  }

  async push(force){
    const board = this.getBoard();
    stampChanges(board, this.stamped, this.now());
    this.stamped = clone(toDoc(board));

    // The question here is not "did anything change" but "does the server
    // already hold this" — after a merge those are different questions.
    if (!force && this.remote && sameDoc(toDoc(board), this.remote)) return false;

    try {
      await this.file.write(toDoc(board), commitMessage(toDoc(board), board.sync.device));
    } catch (err){
      if (!isConflict(err)) throw err;
      // Someone saved between our read and our write: take theirs, merge, retry.
      this.set('merging');
      this.file.etag = null;
      const again = await this.file.read();
      if (again.status === 'ok'){
        const remote = normaliseDoc(again.data, board.sync.device);
        this.absorb(board, remote, this.remote);
        this.remote = clone(remote);
      }
      await this.file.write(toDoc(board), commitMessage(toDoc(board), board.sync.device));
    }

    this.remote = clone(toDoc(board));
    return true;
  }

  /* ---------- scheduling ---------- */

  schedulePoll(){
    clearTimeout(this.pollTimer);
    if (!this.running) return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const wait = this.backoff || (hidden ? POLL_HIDDEN : POLL_ACTIVE);
    this.pollTimer = setTimeout(() => this.cycle(), wait);
  }

  fail(err){
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    this.backoff = Math.min(BACKOFF_MAX, this.backoff ? this.backoff * 2 : 5000);
    this.set(offline ? 'offline' : 'error', String(err && err.message || err));
  }

  set(phase, error){
    this.state = {
      phase,
      at: phase === 'synced' ? Date.now() : this.state.at,
      error: error || '',
      rate: this.file ? this.file.rateRemaining : null,
    };
    this.onStatus(this.state);
  }
}

/** A commit message that says who did what, for the repo's history. */
function commitMessage(doc, device){
  const n = (doc.scenes || []).length;
  return `Board: ${n} scene${n === 1 ? '' : 's'} (${device})`;
}

/** Trust nothing that came off the network. */
function normaliseDoc(raw, device){
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    title: typeof d.title === 'string' ? d.title : '',
    scenes: Array.isArray(d.scenes) ? d.scenes : [],
    connections: Array.isArray(d.connections) ? d.connections : [],
    tokens: Array.isArray(d.tokens) ? d.tokens : [],
    registries: Array.isArray(d.registries) ? d.registries : [],
    sync: readSync(d.sync, device),
  };
}

const clone = v => JSON.parse(JSON.stringify(v));

/**
 * Do two documents say the same thing? The Lamport clock is deliberately
 * excluded: it drifts upward on both sides without the content differing, and
 * pushing over that alone would keep the repo busy for nothing.
 */
function sameDoc(a, b){
  if (!a || !b) return false;
  if (a.title !== b.title) return false;
  if (!SYNCED.every(c => same(a[c] || [], b[c] || []))) return false;
  return same(a.sync.stamps, b.sync.stamps) && same(a.sync.tombs, b.sync.tombs);
}

/**
 * Which of the merged-in changes actually cost this device something.
 *
 * An entity was overridden only if we had edited it since the last agreed
 * snapshot *and* the merge then replaced our version. Without the snapshot
 * the two cases — "we changed it and lost" and "we never touched it" — look
 * identical, which is why this lives here and not in the merge.
 */
function overridden(base, mine, merged, changed){
  if (!base) return [];
  const pick = (doc, id) => {
    for (const c of SYNCED){
      const hit = (doc[c] || []).find(e => e.id === id);
      if (hit) return hit;
    }
    return null;
  };
  return changed.filter(id => {
    const was = pick(base, id);
    const ours = pick(mine, id);
    const now = pick(merged, id);
    return ours && !same(ours, was) && !same(ours, now);
  });
}
