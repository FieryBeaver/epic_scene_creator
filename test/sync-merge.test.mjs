/**
 * The merge rule. Everything else in sync is scheduling; this is the part
 * that decides whether two DMs keep each other's work.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { newSync, stampChanges, toDoc, applyDoc, same } from '../src/js/core/sync/protocol.js';
import { mergeDocs } from '../src/js/core/sync/merge.js';

/** A board with just enough shape for the sync code. */
function board(device, scenes = [], extra = {}){
  return Object.assign({
    title: 'Дошка',
    scenes: scenes.map(s => Object.assign({ id: s.id, name: s.id }, s)),
    connections: [], tokens: [], registries: [],
    sync: newSync(device),
  }, extra);
}

/** Stamp, then hand back the document as another device would receive it. */
function publish(b, base, now){
  stampChanges(b, base, now);
  return JSON.parse(JSON.stringify(toDoc(b)));
}

const ids = doc => doc.scenes.map(s => s.id);
const byId = (doc, id) => doc.scenes.find(s => s.id === id);

test('a first publish stamps everything', () => {
  const a = board('dA', [{ id: 's1' }, { id: 's2' }]);
  const doc = publish(a, null, 1000);
  assert.deepEqual(Object.keys(doc.sync.stamps).sort(), ['s1', 's2']);
  assert.equal(doc.sync.stamps.s1[2], 'dA');
});

test('unchanged entities are not re-stamped', () => {
  const a = board('dA', [{ id: 's1' }]);
  const first = publish(a, null, 1000);
  const revBefore = first.sync.stamps.s1[0];
  const second = publish(a, first, 2000);
  assert.equal(second.sync.stamps.s1[0], revBefore, 'a no-op push must not bump the clock');
});

test('two DMs on different scenes both keep their work', () => {
  const start = publish(board('dA', [{ id: 's1', name: 'Один' }, { id: 's2', name: 'Два' }]), null, 1000);

  const a = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  a.sync.device = 'dA'; b.sync.device = 'dB';

  byId(a, 's1').name = 'Змінив А';
  byId(b, 's2').name = 'Змінив Б';

  const docA = publish(a, start, 2000);
  const docB = publish(b, start, 2001);

  const { doc } = mergeDocs(docA, docB);
  assert.equal(byId(doc, 's1').name, 'Змінив А');
  assert.equal(byId(doc, 's2').name, 'Змінив Б');
});

test('same scene, later save wins — and only for that scene', () => {
  const start = publish(board('dA', [{ id: 's1', name: 'Стара' }, { id: 's2', name: 'Друга' }]), null, 1000);

  const a = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  a.sync.device = 'dA'; b.sync.device = 'dB';

  byId(a, 's1').name = 'Раніше';
  byId(b, 's1').name = 'Пізніше';
  byId(b, 's2').name = 'Б чіпав друге';

  const docA = publish(a, start, 2000);
  const docB = publish(b, start, 3000);   // later wall clock

  const { doc, changed } = mergeDocs(docA, docB);
  assert.equal(byId(doc, 's1').name, 'Пізніше');
  assert.equal(byId(doc, 's2').name, 'Б чіпав друге');
  assert.deepEqual(changed.sort(), ['s1', 's2'], 'both scenes came from the other side');
});

test('merging is symmetric — both devices land on the same board', () => {
  const start = publish(board('dA', [{ id: 's1' }, { id: 's2' }]), null, 1000);
  const a = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  a.sync.device = 'dA'; b.sync.device = 'dB';

  byId(a, 's1').name = 'A';
  byId(b, 's1').name = 'B';
  byId(b, 's2').name = 'B2';

  const docA = publish(a, start, 2000);
  const docB = publish(b, start, 2000);   // identical timestamps: device breaks the tie

  const one = mergeDocs(docA, docB).doc;
  const two = mergeDocs(docB, docA).doc;
  assert.deepEqual(ids(one).sort(), ids(two).sort());
  assert.equal(byId(one, 's1').name, byId(two, 's1').name);
});

test('a new scene from the other device arrives', () => {
  const start = publish(board('dA', [{ id: 's1' }]), null, 1000);
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  b.sync.device = 'dB';
  b.scenes.push({ id: 's9', name: 'Нова від Б' });
  const docB = publish(b, start, 2000);

  const { doc, changed } = mergeDocs(start, docB);
  assert.deepEqual(ids(doc), ['s1', 's9']);
  assert.ok(changed.includes('s9'));
});

test('a deletion survives a device that never heard about it', () => {
  const start = publish(board('dA', [{ id: 's1' }, { id: 's2' }]), null, 1000);

  const a = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  a.sync.device = 'dA';
  a.scenes = a.scenes.filter(s => s.id !== 's2');
  const docA = publish(a, start, 2000);
  assert.ok(docA.sync.tombs.s2, 'deleting records a tombstone');

  // dB still has s2 and has not touched it.
  const { doc } = mergeDocs(JSON.parse(JSON.stringify(start)), docA);
  assert.deepEqual(ids(doc), ['s1']);
  assert.ok(doc.sync.tombs.s2, 'the tombstone travels on, or the next device resurrects it');
});

test('editing a scene after someone deleted it keeps the edit', () => {
  const start = publish(board('dA', [{ id: 's1' }]), null, 1000);

  const deleter = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  deleter.sync.device = 'dA';
  deleter.scenes = [];
  const docDelete = publish(deleter, start, 2000);

  const editor = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  editor.sync.device = 'dB';
  byId(editor, 's1').name = 'Ще потрібна';
  const docEdit = publish(editor, start, 3000);   // strictly later

  const { doc } = mergeDocs(docEdit, docDelete);
  assert.deepEqual(ids(doc), ['s1'], 'the later edit beats the earlier delete');
  assert.equal(byId(doc, 's1').name, 'Ще потрібна');
});

test('tokens and passages merge by the same rule', () => {
  const base = board('dA', [{ id: 's1' }, { id: 's2' }]);
  base.connections = [{ id: 'c1', from: 's1', to: 's2', name: 'Коридор' }];
  base.tokens = [{ id: 't1', name: 'Група', at: { kind: 'scene', id: 's1' } }];
  const start = publish(base, null, 1000);

  const a = applyDoc(board('dA'), JSON.parse(JSON.stringify(start)));
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  a.sync.device = 'dA'; b.sync.device = 'dB';

  a.tokens[0].at = { kind: 'scene', id: 's2' };     // A moves the party
  b.connections[0].open = false;                     // B shuts the corridor

  const { doc } = mergeDocs(publish(a, start, 2000), publish(b, start, 2001));
  assert.deepEqual(doc.tokens[0].at, { kind: 'scene', id: 's2' });
  assert.equal(doc.connections[0].open, false);
});

test('a board with no stamps at all still merges instead of vanishing', () => {
  const legacy = { title: 'Стара', scenes: [{ id: 's1', name: 'Одна' }],
                   connections: [], tokens: [], registries: [], sync: newSync('dA') };
  const other = publish(board('dB', [{ id: 's2' }]), null, 1000);
  const { doc } = mergeDocs(legacy, other);
  assert.deepEqual(ids(doc).sort(), ['s1', 's2']);
});

test('local scene order is preserved; new remote scenes go at the end', () => {
  const start = publish(board('dA', [{ id: 's1' }, { id: 's2' }, { id: 's3' }]), null, 1000);
  const b = applyDoc(board('dB'), JSON.parse(JSON.stringify(start)));
  b.sync.device = 'dB';
  b.scenes.reverse();
  b.scenes.push({ id: 's4' });
  const docB = publish(b, start, 2000);

  const { doc } = mergeDocs(start, docB);
  assert.deepEqual(ids(doc), ['s1', 's2', 's3', 's4']);
});

test('same() compares structure, not identity', () => {
  assert.ok(same({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert.ok(!same({ a: 1 }, { a: 1, b: undefined }));
  assert.ok(!same([1, 2], [2, 1]));
  assert.ok(same(null, null));
  assert.ok(!same(null, {}));
});
