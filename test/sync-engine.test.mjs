/**
 * The sync loop against a fake Contents API: two devices, one file, no
 * network. Covers the paths that are awkward to reach by hand — the 409 that
 * GitHub returns when someone saved first, and the 304 that keeps polling
 * cheap.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SyncEngine } from '../src/js/core/sync/engine.js';
import { newSync, stampChanges, toDoc } from '../src/js/core/sync/protocol.js';
import { toBase64, fromBase64, GitHubFile } from '../src/js/core/sync/github.js';

/** Minimal stand-in for `GET/PUT /repos/:o/:r/contents/:path`. */
function fakeRepo(){
  const repo = {
    content: null, sha: null, version: 0, writes: 0, reads: 0, conditional: 0,
    hook: null,                       // lets a test interleave a write mid-request
  };

  const headers = map => ({ get: k => map[k.toLowerCase()] ?? null });

  repo.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';

    if (url.includes('/contents/') && method === 'GET'){
      repo.reads++;
      if (repo.hook) { const h = repo.hook; repo.hook = null; await h(); }
      if (repo.content === null){
        return { ok: false, status: 404, statusText: 'Not Found',
                 headers: headers({}), json: async () => ({ message: 'Not Found' }) };
      }
      const tag = `"v${repo.version}"`;
      if ((opts.headers || {})['If-None-Match'] === tag){
        repo.conditional++;
        return { ok: false, status: 304, statusText: 'Not Modified', headers: headers({ etag: tag }) };
      }
      return {
        ok: true, status: 200, headers: headers({ etag: tag, 'x-ratelimit-remaining': '4999' }),
        json: async () => ({ content: toBase64(repo.content), sha: repo.sha }),
      };
    }

    if (url.includes('/contents/') && method === 'PUT'){
      const body = JSON.parse(opts.body);
      if ((body.sha || null) !== repo.sha){
        return { ok: false, status: 409, statusText: 'Conflict',
                 headers: headers({}), json: async () => ({ message: 'does not match' }) };
      }
      repo.writes++;
      repo.version++;
      repo.content = fromBase64(body.content);
      repo.sha = 'sha' + repo.version;
      return { ok: true, status: 200, headers: headers({}),
               json: async () => ({ content: { sha: repo.sha } }) };
    }

    // repo probe
    return { ok: true, status: 200, headers: headers({}),
             json: async () => ({ private: true, permissions: { push: true } }) };
  };

  repo.read = () => (repo.content === null ? null : JSON.parse(repo.content));
  return repo;
}

function board(device, scenes = []){
  return {
    title: 'Дошка', scenes, connections: [], tokens: [], registries: [],
    ui: { railW: 300 }, sync: newSync(device),
  };
}

const CFG = { owner: 'o', repo: 'r', path: 'board.json', token: 't' };

/**
 * Stamp the edits a device has made but not yet sent — what happens when the
 * push fires while the network is down, and the reason stamp order can differ
 * from save order.
 */
function stampLocally(engine, b, at){
  stampChanges(b, engine.stamped, at);
  engine.stamped = JSON.parse(JSON.stringify(toDoc(b)));
}

/**
 * Stamp order decides who wins a merge, so tests drive the clock instead of
 * racing the millisecond — `clock.t` is the time every stamp will carry.
 */
function engineFor(b, repo, onRemote, clock){
  const e = new SyncEngine({
    getBoard: () => b, onRemote, fetchImpl: repo.fetch,
    now: clock ? () => clock.t : undefined,
  });
  e.schedulePoll = () => {};         // drive the cycle by hand in tests
  return e;
}

test('first device seeds the file', async () => {
  const repo = fakeRepo();
  const b = board('dA', [{ id: 's1', name: 'Перша' }]);
  const e = engineFor(b, repo);

  await e.start(CFG);
  e.stop();

  const stored = repo.read();
  assert.equal(stored.scenes.length, 1);
  assert.equal(stored.scenes[0].name, 'Перша');
  assert.ok(stored.sync.stamps.s1, 'the seeded file carries stamps');
});

test('local-only fields never leave the device', async () => {
  const repo = fakeRepo();
  const b = board('dA', [{ id: 's1', name: 'Перша' }]);
  const e = engineFor(b, repo);
  await e.start(CFG);
  e.stop();

  const stored = repo.read();
  assert.equal(stored.ui, undefined, 'panel widths are not other DMs’ business');
  assert.equal(stored.camera, undefined);
});

test('a second device picks the board up', async () => {
  const repo = fakeRepo();
  const a = board('dA', [{ id: 's1', name: 'Перша' }]);
  const ea = engineFor(a, repo);
  await ea.start(CFG);
  ea.stop();

  const b = board('dB');
  const eb = engineFor(b, repo);
  await eb.start(CFG);
  eb.stop();

  assert.deepEqual(b.scenes.map(s => s.name), ['Перша']);
});

test('edits flow both ways and converge', async () => {
  const repo = fakeRepo();
  const a = board('dA', [{ id: 's1', name: 'Перша' }, { id: 's2', name: 'Друга' }]);
  const ea = engineFor(a, repo);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo);
  await eb.start(CFG);

  a.scenes[0].name = 'A змінив';
  b.scenes[1].name = 'B змінив';

  await ea.syncNow();
  await eb.syncNow();
  await ea.syncNow();

  const names = board => board.scenes.map(s => s.name).sort();
  assert.deepEqual(names(a), ['A змінив', 'B змінив']);
  assert.deepEqual(names(b), ['A змінив', 'B змінив']);
  ea.stop(); eb.stop();
});

test('a 409 is resolved by merging, not by losing a save', async () => {
  const repo = fakeRepo();
  const a = board('dA', [{ id: 's1', name: 'Перша' }, { id: 's2', name: 'Друга' }]);
  const ea = engineFor(a, repo);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo);
  await eb.start(CFG);

  // A is about to push; B slips a change in between A's read and A's write.
  a.scenes[0].name = 'A змінив';
  repo.hook = async () => {
    b.scenes[1].name = 'B встиг перший';
    await eb.syncNow();
  };

  await ea.syncNow();

  const stored = repo.read();
  const byName = stored.scenes.map(s => s.name).sort();
  assert.deepEqual(byName, ['A змінив', 'B встиг перший'],
    'neither save was dropped by the conflict');
  ea.stop(); eb.stop();
});

test('an unchanged poll costs one conditional request and no write', async () => {
  const repo = fakeRepo();
  const b = board('dA', [{ id: 's1', name: 'Перша' }]);
  const e = engineFor(b, repo);
  await e.start(CFG);
  const writesAfterSeed = repo.writes;

  await e.cycle();
  await e.cycle();

  assert.equal(repo.writes, writesAfterSeed, 'idle polling must not write');
  assert.ok(repo.conditional >= 1, 'the ETag is being sent');
  e.stop();
});

test('a failed request backs off and keeps the pending save', async () => {
  const repo = fakeRepo();
  const b = board('dA', [{ id: 's1', name: 'Перша' }]);
  const e = engineFor(b, repo);
  await e.start(CFG);

  const boom = new Error('network down');
  e.file.fetch = async () => { throw boom; };
  b.scenes[0].name = 'офлайн-правка';
  e.pushWanted = true;
  await e.cycle();

  assert.equal(e.state.phase, 'error');
  assert.ok(e.backoff > 0, 'the next poll waits longer');
  assert.equal(e.pushWanted, true, 'the unsent change is still queued');

  e.file.fetch = repo.fetch;
  await e.cycle();
  assert.equal(repo.read().scenes[0].name, 'офлайн-правка', 'it goes out once the network is back');
  assert.equal(e.state.phase, 'synced');
  e.stop();
});

test('a deletion on one device removes the scene on the other', async () => {
  const repo = fakeRepo();
  const a = board('dA', [{ id: 's1', name: 'Перша' }, { id: 's2', name: 'Друга' }]);
  const ea = engineFor(a, repo);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo);
  await eb.start(CFG);
  assert.equal(b.scenes.length, 2);

  a.scenes = a.scenes.filter(s => s.id !== 's2');
  await ea.syncNow();
  await eb.syncNow();

  assert.deepEqual(b.scenes.map(s => s.id), ['s1']);
  ea.stop(); eb.stop();
});

test('an arriving change is announced, and is not called an override', async () => {
  const repo = fakeRepo();
  const clock = { t: 1000 };
  const seen = [];
  const a = board('dA', [{ id: 's1', name: 'Перша' }, { id: 's2', name: 'Друга' }]);
  const ea = engineFor(a, repo, (ids, over) => seen.push({ ids, over }), clock);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo, null, clock);
  await eb.start(CFG);

  clock.t = 2000;
  b.scenes[1].name = 'B перейменував';
  await eb.syncNow();

  clock.t = 3000;
  await ea.syncNow();                       // A changed nothing of its own

  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].ids, ['s2']);
  assert.deepEqual(seen[0].over, [], 'A lost nothing, so nothing is reported as lost');
  ea.stop(); eb.stop();
});

test('an offline edit beaten by a later save is reported as an override', async () => {
  const repo = fakeRepo();
  const clock = { t: 1000 };
  const seen = [];
  const a = board('dA', [{ id: 's1', name: 'Перша' }]);
  const ea = engineFor(a, repo, (ids, over) => seen.push({ ids, over }), clock);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo, null, clock);
  await eb.start(CFG);

  clock.t = 2000;                            // A edits, and its push fails…
  a.scenes[0].name = 'A перейменував';
  stampLocally(ea, a, 2000);                 // …so the edit is stamped but unsent

  clock.t = 3000;                            // …and B saves later
  b.scenes[0].name = 'B перейменував';
  await eb.syncNow();

  clock.t = 4000;
  await ea.syncNow();

  assert.equal(a.scenes[0].name, 'B перейменував', 'the later save wins');
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].over, ['s1'], 'A is told its edit did not survive');
  ea.stop(); eb.stop();
});

test('an earlier remote save loses to a later local edit, silently', async () => {
  const repo = fakeRepo();
  const clock = { t: 1000 };
  const seen = [];
  const a = board('dA', [{ id: 's1', name: 'Перша' }]);
  const ea = engineFor(a, repo, (ids, over) => seen.push({ ids, over }), clock);
  await ea.start(CFG);

  const b = board('dB');
  const eb = engineFor(b, repo, null, clock);
  await eb.start(CFG);

  clock.t = 2000;
  b.scenes[0].name = 'B раніше';
  await eb.syncNow();

  clock.t = 3000;                            // A edits after B saved
  a.scenes[0].name = 'A пізніше';
  await ea.syncNow();

  assert.equal(a.scenes[0].name, 'A пізніше');
  assert.equal(seen.length, 0, 'nothing arrived that A had to be told about');
  assert.equal(repo.read().scenes[0].name, 'A пізніше');
  ea.stop(); eb.stop();
});

test('base64 survives Cyrillic', () => {
  const text = 'Гробниця Дев\'яти Богів — «сцена» ✕ ⛩';
  assert.equal(fromBase64(toBase64(text)), text);
});

test('the file URL escapes owner, repo and each path segment', () => {
  const f = new GitHubFile({ owner: 'a b', repo: 'r+1', path: 'sub dir/board.json', token: 't' });
  assert.equal(f.url,
    'https://api.github.com/repos/a%20b/r%2B1/contents/sub%20dir/board.json');
});
