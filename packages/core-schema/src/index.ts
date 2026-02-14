import { z } from 'zod';

export const UNIVERSAL_RUN_STATE_SCHEMA_VERSION = 1 as const;

export const zUVec2 = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const zUEntityState = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  pos: zUVec2,
  tick: z.number().int().nonnegative()
});

export const zUFrame = z.object({
  tick: z.number().int().nonnegative(),
  entities: z.array(zUEntityState)
});

const zStringNumberRecord = z.record(z.string(), z.number().finite());
const zStringArrayRecord = z.record(z.string(), z.array(z.string().min(1)));

export const zPlayerRunState = z.object({
  stats: zStringNumberRecord.default({}),
  inventory: z.array(z.string().min(1)).default([]),
  relics: z.array(z.string().min(1)).default([]),
  perks: z.array(z.string().min(1)).default([])
});

export const zRunSection = z.object({
  seed: z.string().min(1),
  lensIndex: z.number().int().nonnegative(),
  difficulty: z.string().min(1),
  mutators: z.array(z.string().min(1)).default([]),
  storyFlags: zStringArrayRecord.default({})
});

export const zTeamSection = z.object({
  currency: z.number().int().nonnegative(),
  keys: z.record(z.string(), z.number().int().nonnegative()).default({}),
  relics: z.array(z.string().min(1)).default([])
});

export const zPersistentWorldEntity = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  biome: z.string().min(1).optional(),
  state: z.record(z.string(), z.unknown()).default({})
});

export const zWorldSection = z.object({
  biome: z.string().min(1),
  hazards: z.array(z.string().min(1)).default([]),
  persistentEntities: z.array(zPersistentWorldEntity).default([])
});

export const zUniversalRunStateV1 = z.object({
  schemaVersion: z.literal(UNIVERSAL_RUN_STATE_SCHEMA_VERSION),
  run: zRunSection,
  players: z.record(z.string().min(1), zPlayerRunState),
  team: zTeamSection,
  world: zWorldSection
});

export const zUniversalRunStateEnvelope = z.object({
  schemaVersion: z.number().int().positive(),
  run: z.unknown(),
  players: z.unknown(),
  team: z.unknown(),
  world: z.unknown()
});

export type UVec2 = z.infer<typeof zUVec2>;
export type UEntityState = z.infer<typeof zUEntityState>;
export type UFrame = z.infer<typeof zUFrame>;
export type PlayerRunState = z.infer<typeof zPlayerRunState>;
export type UniversalRunState = z.infer<typeof zUniversalRunStateV1>;

export type UniversalRunStateMigration = (input: unknown) => unknown;

const migrationHooks = new Map<number, UniversalRunStateMigration>([
  [UNIVERSAL_RUN_STATE_SCHEMA_VERSION, (input) => input]
]);

export function registerUniversalRunStateMigration(
  schemaVersion: number,
  migration: UniversalRunStateMigration
): void {
  migrationHooks.set(schemaVersion, migration);
}

export function migrateUniversalRunState(input: unknown): UniversalRunState {
  const envelope = zUniversalRunStateEnvelope.parse(input);
  const migration = migrationHooks.get(envelope.schemaVersion);

  if (!migration) {
    throw new Error(`No migration hook registered for schemaVersion ${envelope.schemaVersion}`);
  }

  const migrated = migration(input);
  return zUniversalRunStateV1.parse(migrated);
}

export function parseFrame(input: unknown): UFrame {
  return zUFrame.parse(input);
}

export function parseUniversalRunState(input: unknown): UniversalRunState {
  return migrateUniversalRunState(input);
}

export function parseUniversalRunStateForHostIngress(input: unknown): UniversalRunState {
  return parseUniversalRunState(input);
}

export function parseUniversalRunStateForPluginBoundary(input: unknown): UniversalRunState {
  return parseUniversalRunState(input);
}

function sortForDeterministicSerialization(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortForDeterministicSerialization(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => [key, sortForDeterministicSerialization(entryValue)]);

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function serializeUniversalRunStateDeterministically(
  state: UniversalRunState
): string {
  const validatedState = parseUniversalRunState(state);
  return JSON.stringify(sortForDeterministicSerialization(validatedState));
}

export function deserializeUniversalRunState(serialized: string): UniversalRunState {
  const parsed = JSON.parse(serialized) as unknown;
  return parseUniversalRunState(parsed);
}

export interface DeltaU {
  schemaVersion: typeof UNIVERSAL_RUN_STATE_SCHEMA_VERSION;
  atTick: number;
  run?: Partial<UniversalRunState['run']>;
  players?: Record<string, Partial<PlayerRunState>>;
  team?: Partial<UniversalRunState['team']>;
  world?: Partial<UniversalRunState['world']>;
}

export const zDeltaU = z.object({
  schemaVersion: z.literal(UNIVERSAL_RUN_STATE_SCHEMA_VERSION),
  atTick: z.number().int().nonnegative(),
  run: zRunSection.partial().optional(),
  players: z.record(z.string().min(1), zPlayerRunState.partial()).optional(),
  team: zTeamSection.partial().optional(),
  world: zWorldSection.partial().optional()
});

export function parseDeltaU(input: unknown): DeltaU {
  return zDeltaU.parse(input);
}

export function serializeDeltaUDeterministically(delta: DeltaU): string {
  const validatedDelta = parseDeltaU(delta);
  return JSON.stringify(sortForDeterministicSerialization(validatedDelta));
}

export function deserializeDeltaU(serialized: string): DeltaU {
  const parsed = JSON.parse(serialized) as unknown;
  return parseDeltaU(parsed);
}
