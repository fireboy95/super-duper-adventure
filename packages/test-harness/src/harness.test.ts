import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTransitionAnchors,
  decodeFrame,
  encodeFrame,
  frameChecksum,
  ensureFrame,
  reconcileInputs,
  runDeterministicReplay,
  type AnchorState,
  type CapturedInput,
  type ReplayFixture
} from './index.js';

const baseFixture: ReplayFixture = {
  seed: 1337,
  initialFrame: ensureFrame({
    tick: 0,
    entities: [
      { id: 'p1', kind: 'player', tick: 0, pos: { x: 0, y: 0 } },
      { id: 'p2', kind: 'player', tick: 0, pos: { x: 10, y: 0 } }
    ]
  }),
  inputs: [
    { playerId: 'p1', seq: 1, tick: 1, delta: { x: 1, y: 0 }, arrivalMs: 10 },
    { playerId: 'p2', seq: 1, tick: 1, delta: { x: -2, y: 1 }, arrivalMs: 8 },
    { playerId: 'p1', seq: 2, tick: 2, delta: { x: 1, y: 1 }, arrivalMs: 16 }
  ]
};

test('deterministic replay equality generates stable U snapshots/checksum', async () => {
  const firstRun = await runDeterministicReplay(baseFixture);
  const secondRun = await runDeterministicReplay(baseFixture);

  assert.deepEqual(firstRun.snapshots, secondRun.snapshots);
  assert.equal(firstRun.checksum, secondRun.checksum);
  assert.equal(firstRun.checksum, frameChecksum(firstRun.finalFrame));
});

test('lens decode/encode roundtrip integrity', () => {
  const encoded = encodeFrame(baseFixture.initialFrame);
  const decoded = decodeFrame(encoded);

  assert.deepEqual(decoded, baseFixture.initialFrame);
});

test('multiplayer input ordering/reconciliation sorts by tick and dedupes by player+seq', () => {
  const scrambled: CapturedInput[] = [
    { playerId: 'p1', seq: 2, tick: 2, delta: { x: 1, y: 1 }, arrivalMs: 16 },
    { playerId: 'p2', seq: 1, tick: 1, delta: { x: -2, y: 1 }, arrivalMs: 8 },
    { playerId: 'p1', seq: 1, tick: 1, delta: { x: 1, y: 0 }, arrivalMs: 10 },
    { playerId: 'p1', seq: 1, tick: 1, delta: { x: 99, y: 99 }, arrivalMs: 25 }
  ];

  const ordered = reconcileInputs(scrambled);

  assert.deepEqual(
    ordered.map((entry) => `${entry.tick}:${entry.playerId}:${entry.seq}:${entry.delta.x}`),
    ['1:p2:1:-2', '1:p1:1:1', '2:p1:2:1']
  );
});

test('transition anchor preservation keeps hp/inventory/relic continuity', () => {
  const previous: Record<string, AnchorState> = {
    p1: { hp: 80, inventory: ['potion'], relics: ['sun-dial'] },
    p2: { hp: 35, inventory: ['bomb', 'key'], relics: ['moon-seal'] }
  };

  const merged = applyTransitionAnchors(previous, {
    p1: { hp: 75 },
    p2: { inventory: ['bomb', 'key', 'elixir'] }
  });

  assert.deepEqual(merged, {
    p1: { hp: 75, inventory: ['potion'], relics: ['sun-dial'] },
    p2: { hp: 35, inventory: ['bomb', 'key', 'elixir'], relics: ['moon-seal'] }
  });
});
