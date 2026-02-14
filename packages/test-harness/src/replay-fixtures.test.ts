import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureFrame, runDeterministicReplay, type ReplayFixture } from './index.js';

interface ReplayRegressionFixture {
  name: string;
  fixture: ReplayFixture;
  expectedChecksum: string;
  expectedSnapshotCount: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('replay regression fixtures remain stable', async () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/replay/basic.json');
  const raw = JSON.parse(await readFile(fixturePath, 'utf-8')) as ReplayRegressionFixture;

  const fixture: ReplayFixture = {
    ...raw.fixture,
    initialFrame: ensureFrame(raw.fixture.initialFrame)
  };

  const result = await runDeterministicReplay(fixture);

  assert.equal(result.checksum, raw.expectedChecksum);
  assert.equal(result.snapshots.length, raw.expectedSnapshotCount);
});
