import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../packages/test-harness/fixtures/replay');

const files = (await readdir(fixturesDir)).filter((name) => name.endsWith('.json'));

for (const file of files) {
  const fullPath = path.join(fixturesDir, file);
  const parsed = JSON.parse(await readFile(fullPath, 'utf8'));
  const frame = parsed?.fixture?.initialFrame;

  if (!Number.isInteger(frame?.tick) || frame.tick < 0 || !Array.isArray(frame?.entities)) {
    throw new Error(`Fixture ${file} has invalid initialFrame shape.`);
  }

  for (const entity of frame.entities) {
    if (
      typeof entity?.id !== 'string' ||
      typeof entity?.kind !== 'string' ||
      !Number.isInteger(entity?.tick) ||
      typeof entity?.pos?.x !== 'number' ||
      typeof entity?.pos?.y !== 'number'
    ) {
      throw new Error(`Fixture ${file} has invalid entity schema.`);
    }
  }

  if (!Array.isArray(parsed?.fixture?.inputs)) {
    throw new Error(`Fixture ${file} is missing fixture.inputs array`);
  }
}

console.log(`Validated ${files.length} replay schema fixture(s).`);
