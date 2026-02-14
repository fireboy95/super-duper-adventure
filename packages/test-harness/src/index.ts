import { createHash } from 'node:crypto';

export interface UVec2 {
  x: number;
  y: number;
}

export interface UEntityState {
  id: string;
  kind: string;
  pos: UVec2;
  tick: number;
}

export interface UFrame {
  tick: number;
  entities: UEntityState[];
}

export interface CapturedInput {
  playerId: string;
  seq: number;
  tick: number;
  delta: { x: number; y: number };
  arrivalMs: number;
}

export interface AnchorState {
  hp: number;
  inventory: string[];
  relics: string[];
}

export interface SimulationResult {
  finalFrame: UFrame;
  snapshots: UFrame[];
  checksum: string;
}

export interface ReplayFixture {
  seed: number;
  initialFrame: UFrame;
  inputs: CapturedInput[];
}

export interface HostBindings {
  random(): number;
  log(message: string): void;
}

export interface LensPlugin {
  onFrame(frame: UFrame, host: HostBindings): UFrame;
}

export function ensureFrame(input: unknown): UFrame {
  const frame = input as Partial<UFrame>;
  if (!Number.isInteger(frame.tick) || frame.tick! < 0 || !Array.isArray(frame.entities)) {
    throw new Error('Invalid frame');
  }

  for (const entity of frame.entities) {
    if (
      typeof entity?.id !== 'string' ||
      typeof entity?.kind !== 'string' ||
      !Number.isInteger(entity?.tick) ||
      typeof entity?.pos?.x !== 'number' ||
      typeof entity?.pos?.y !== 'number'
    ) {
      throw new Error('Invalid entity');
    }
  }

  return frame as UFrame;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function frameChecksum(frame: UFrame): string {
  return createHash('sha256').update(stableStringify(frame)).digest('hex');
}

export const encodeFrame = (frame: UFrame): string => JSON.stringify(frame);
export const decodeFrame = (serialized: string): UFrame => ensureFrame(JSON.parse(serialized));

export function reconcileInputs(inputs: CapturedInput[]): CapturedInput[] {
  const seen = new Set<string>();
  return [...inputs]
    .sort((a, b) => a.tick - b.tick || a.arrivalMs - b.arrivalMs || a.playerId.localeCompare(b.playerId) || a.seq - b.seq)
    .filter((input) => {
      const key = `${input.playerId}:${input.seq}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function applyTransitionAnchors(previous: Record<string, AnchorState>, next: Record<string, Partial<AnchorState>>): Record<string, AnchorState> {
  const merged: Record<string, AnchorState> = {};
  for (const [playerId, prev] of Object.entries(previous)) {
    const patch = next[playerId] ?? {};
    merged[playerId] = {
      hp: patch.hp ?? prev.hp,
      inventory: patch.inventory ?? prev.inventory,
      relics: patch.relics ?? prev.relics
    };
  }
  return merged;
}

const simulationLens: LensPlugin = {
  onFrame(frame, host) {
    const jitter = Math.floor(host.random() * 3);
    return {
      ...frame,
      entities: frame.entities.map((entity: UEntityState) => ({
        ...entity,
        pos: { x: entity.pos.x + jitter, y: entity.pos.y + jitter }
      }))
    };
  }
};

export async function runDeterministicReplay(fixture: ReplayFixture): Promise<SimulationResult> {
  const random = seededRandom(fixture.seed);
  const host: HostBindings = { random, log: () => {} };
  const orderedInputs = reconcileInputs(fixture.inputs);
  const snapshots: UFrame[] = [];
  let frame = ensureFrame(fixture.initialFrame);

  for (const input of orderedInputs) {
    frame = {
      ...frame,
      tick: input.tick,
      entities: frame.entities.map((entity) =>
        entity.id === input.playerId
          ? { ...entity, tick: input.tick, pos: { x: entity.pos.x + input.delta.x, y: entity.pos.y + input.delta.y } }
          : entity
      )
    };
    frame = simulationLens.onFrame(frame, host);
    snapshots.push(frame);
  }

  return { finalFrame: frame, snapshots, checksum: frameChecksum(frame) };
}
