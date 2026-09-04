/**
 * Board file reading/writing. These are the parts worth testing in isolation:
 * they are pure, and they are the only place where a file written months ago
 * has to keep working.
 *
 * Run with: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { serialize, deserialize, exportFilename } from '../src/js/core/serialize.js';
import { blank } from '../src/js/core/state.js';

const camera = { x: 10, y: 20, z: 1.5 };

/** Smallest board a file can describe. */
function minimal(){
  return { scenes: [{ id: 's1', name: 'Перша' }] };
}

test('rejects anything that is not a board', () => {
  assert.throws(() => deserialize(null), /scenes/);
  assert.throws(() => deserialize({}), /scenes/);
  assert.throws(() => deserialize({ scenes: 'nope' }), /scenes/);
});

test('fills in every field a scene is missing', () => {
  const b = deserialize(minimal());
  const s = b.scenes[0];
  assert.equal(s.name, 'Перша');
  assert.deepEqual([s.dangers, s.blocks, s.events, s.locations, s.counters], [[], [], [], [], []]);
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
  assert.equal(typeof s.color, 'string');
});

test('keeps the default registries when the file has none', () => {
  const b = deserialize(minimal());
  assert.deepEqual(b.registries.map(r => r.id), ['gods', 'keys']);
  assert.equal(b.registries[0].items.length, 9);
  assert.equal(b.registries[1].items.length, 5);
});

test('round-trips a board through serialize/deserialize', () => {
  const before = deserialize({
    scenes: [
      { id: 's1', name: 'Перша', x: 100, y: 50, dm: 'Бобер',
        counters: [{ id: 'n1', label: 'хвиля', value: 3 }] },
      { id: 's2', name: 'Друга', x: 400, y: 50 },
    ],
    connections: [{ id: 'c1', from: 's1', to: 's2', name: 'Коридор', dir: 'one', minutes: 2 }],
    tokens: [{ id: 't1', name: 'Група', type: 'party', at: { kind: 'scene', id: 's1' } }],
  });

  const after = deserialize(JSON.parse(JSON.stringify(serialize(before, camera))));

  assert.deepEqual(after.scenes, before.scenes);
  assert.deepEqual(after.connections, before.connections);
  assert.deepEqual(after.tokens, before.tokens);
});

test('serialize stamps the viewport and the export time', () => {
  const data = serialize(blank(), camera);
  assert.deepEqual(data.camera, camera);
  assert.equal(data.app, 'toa-scene-board');
  assert.equal(data.version, 3);
  assert.match(data.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('export filename carries the timestamp', () => {
  assert.equal(exportFilename(new Date('2026-09-04T11:05:00Z')),
    'dungeon-board-2026-09-04-11-05.json');
});

test('drops connections whose scenes are gone', () => {
  const b = deserialize({
    scenes: [{ id: 's1', name: 'Одна' }],
    connections: [
      { id: 'c1', from: 's1', to: 'ghost' },
      { id: 'c2', from: 'ghost', to: 's1' },
    ],
  });
  assert.equal(b.connections.length, 0);
});

test('takes a token off the map when its place is gone', () => {
  const b = deserialize({
    scenes: [{ id: 's1', name: 'Одна' }],
    tokens: [
      { id: 't1', name: 'Тут', at: { kind: 'scene', id: 's1' } },
      { id: 't2', name: 'Ніде', at: { kind: 'scene', id: 'ghost' } },
    ],
  });
  assert.deepEqual(b.tokens[0].at, { kind: 'scene', id: 's1' });
  assert.equal(b.tokens[1].at, null);
});

test('keeps the id counter ahead of the ids already in the file', () => {
  const b = deserialize({ seq: 1, scenes: [{ id: 's42abc', name: 'Сорок друга' }] });
  assert.ok(b.seq > 42, `expected seq past 42, got ${b.seq}`);
});

/* ---------- migration from pre-v3 files ---------- */

test('migrates scene.gods and scene.keys into rooms', () => {
  const b = deserialize({
    scenes: [{ id: 's1', name: 'Стара', gods: ['moa'], keys: ['k3'] }],
  });
  const rooms = b.scenes[0].locations;
  assert.equal(rooms.length, 2);
  assert.deepEqual(rooms[0].reg, { gods: 'moa' });
  assert.deepEqual(rooms[1].reg, { keys: 'k3' });
});

test('migrates standalone treasures into treasure rooms', () => {
  const b = deserialize({
    scenes: [{
      id: 's1', name: 'Стара',
      treasures: [{ id: 'tr1', nm: 'Купа монет', what: '8 000 gp', guard: 'Бехолдер', done: true }],
    }],
  });
  const [room] = b.scenes[0].locations;
  assert.equal(room.nm, 'Купа монет');
  assert.equal(room.hasTre, true);
  assert.equal(room.tre, '8 000 gp');
  assert.equal(room.guard, 'Бехолдер');
  assert.equal(room.taken, true);
});

test('re-points a legacy treasure block at the room the treasure became', () => {
  const b = deserialize({
    scenes: [{
      id: 's1', name: 'Стара',
      treasures: [{ id: 'tr1', nm: 'Золото', what: '1 gp' }],
      blocks: [{ id: 'b1', nm: 'Замок', tgtKind: 'treasure', tgt: 'tr1' }],
    }],
  });
  const [room] = b.scenes[0].locations;
  const [block] = b.scenes[0].blocks;
  assert.equal(block.tgtKind, 'loc');
  assert.equal(block.tgt, room.id);
  assert.equal('_legacyKind' in block, false);
});

test('re-points a legacy god block at the room holding that god', () => {
  const b = deserialize({
    scenes: [{
      id: 's1', name: 'Стара', gods: ['wongo'],
      blocks: [{ id: 'b1', nm: 'Печатка', tgtKind: 'god', tgt: 'wongo' }],
    }],
  });
  const room = b.scenes[0].locations.find(l => l.reg.gods === 'wongo');
  assert.equal(b.scenes[0].blocks[0].tgt, room.id);
});

test('strips the migration bookkeeping from rooms', () => {
  const b = deserialize({
    scenes: [{ id: 's1', name: 'Стара', treasures: [{ id: 'tr1', nm: 'Золото' }] }],
  });
  const [room] = b.scenes[0].locations;
  assert.equal('_oldId' in room, false);
  assert.equal('_oldBlock' in room, false);
});

test('normalises out-of-range and wrong-typed values', () => {
  const b = deserialize({
    scenes: [{
      id: 's1', name: 42, x: '120.7', y: null,
      dangers: [{ id: 'd1', nm: 'Х', lvl: 99 }],
      counters: [{ id: 'n1', label: 'x', value: 'нечисло' }],
    }],
    connections: [{ id: 'c1', from: 's1', to: 's1', minutes: '3' }],
  });
  const s = b.scenes[0];
  assert.equal(s.name, '42');
  assert.equal(s.x, 120);
  assert.equal(s.y, 0);
  assert.equal(s.dangers[0].lvl, 4);
  assert.equal(s.counters[0].value, 0);
  assert.equal(b.connections[0].minutes, 3);
});

test('empty registry slots are not carried over', () => {
  const b = deserialize({
    scenes: [{ id: 's1', name: 'Одна', locations: [{ id: 'l1', nm: 'Зала', reg: { gods: '' } }] }],
  });
  assert.deepEqual(b.scenes[0].locations[0].reg, {});
});
