import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pluginApiPath = path.resolve(__dirname, '../../packages/plugin-api/src/index.ts');
const pluginApiSource = await readFile(pluginApiPath, 'utf8');
const versionMatch = pluginApiSource.match(/WIT_CONTRACT_VERSION[^=]*=\s*'([^']+)'/);

if (!versionMatch) {
  throw new Error('Unable to locate WIT_CONTRACT_VERSION export.');
}

const expectedVersion = versionMatch[1];
const manifestPath = path.resolve(__dirname, '../../packages/lenses/echo-lens/package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.adventureContractVersion !== expectedVersion) {
  throw new Error(
    `Contract mismatch for ${manifest.name}: expected ${expectedVersion} got ${manifest.adventureContractVersion}`
  );
}

console.log(`Verified contract compatibility for ${manifest.name} at ${expectedVersion}.`);
