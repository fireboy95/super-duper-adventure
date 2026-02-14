import {
  parseFrame,
  parseMetaRewardPackage,
  type MetaRewardPackage,
  type UFrame
} from '@adventure/core-schema';
import { arcadeLensPlugin } from '@adventure/lens-arcade-lens';
import { bossOverseerPlugin } from '@adventure/lens-boss-overseer';
import { echoLensPlugin } from '@adventure/lens-echo';
import { LensRuntime } from '@adventure/lens-runtime';
import { stealthLensPlugin } from '@adventure/lens-stealth-lens';
import { createWebSocketLobby } from '@adventure/net';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';
import {
  InMemoryMetaProgressionPersistence,
  applyMetaRewards,
  createDefaultMetaProfile
} from './meta-progression.js';

const MIN_LENS_DURATION_MS = 2 * 60 * 1000;
const MAX_LENS_DURATION_MS = 5 * 60 * 1000;

type RunPhase = 'lobby/nexus' | 'lens-sequence' | 'boss-lens' | 'run-end' | 'meta-progression';

interface LensDefinition {
  plugin: LensPlugin;
  genre: string;
}

interface MutatorDefinition {
  id: string;
  appliesToGenre?: string;
}

interface PlannedLens {
  lens: LensDefinition;
  mutators: string[];
  targetDurationMs: number;
}

interface RunPlan {
  runId: string;
  seed: number;
  lensSequence: PlannedLens[];
  bossLens: PlannedLens;
}

interface OrchestrationConfig {
  seed: number;
  lensTargetDurationMs: number;
  profileId: string;
}

const hostBindings: HostBindings = {
  nowMs: () => Date.now(),
  random: () => Math.random(),
  log: (message: string) => console.log(`[lens] ${message}`)
};

const baseLenses: LensDefinition[] = [
  { plugin: echoLensPlugin, genre: 'sandbox' },
  { plugin: arcadeLensPlugin, genre: 'arcade' },
  { plugin: stealthLensPlugin, genre: 'stealth' }
];

const bossLens: LensDefinition = { plugin: bossOverseerPlugin, genre: 'boss' };

const mutators: MutatorDefinition[] = [
  { id: 'mutator/double-enemies', appliesToGenre: 'arcade' },
  { id: 'mutator/volatile-world' },
  { id: 'mutator/shadow-ops', appliesToGenre: 'stealth' }
];

function assertLensDuration(targetMs: number): number {
  if (targetMs < MIN_LENS_DURATION_MS || targetMs > MAX_LENS_DURATION_MS) {
    throw new Error(
      `lensTargetDurationMs must be between ${MIN_LENS_DURATION_MS} and ${MAX_LENS_DURATION_MS}`
    );
  }

  return targetMs;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function buildRunPlan(seed: number, lensTargetDurationMs: number): RunPlan {
  const nextRandom = seededRandom(seed);
  const shuffled = [...baseLenses].sort(() => nextRandom() - 0.5);

  const lensSequence = shuffled.map((lens): PlannedLens => {
    const selectedMutators = mutators
      .filter((mutator) => !mutator.appliesToGenre || mutator.appliesToGenre === lens.genre)
      .filter(() => nextRandom() > 0.45)
      .map((mutator) => mutator.id);

    return {
      lens,
      mutators: selectedMutators,
      targetDurationMs: lensTargetDurationMs
    };
  });

  return {
    runId: `run-${seed}`,
    seed,
    lensSequence,
    bossLens: {
      lens: bossLens,
      mutators: ['mutator/boss-rage-timer'],
      targetDurationMs: lensTargetDurationMs
    }
  };
}

async function runLens(plannedLens: PlannedLens, frame: UFrame): Promise<UFrame> {
  hostBindings.log(
    `starting ${plannedLens.lens.plugin.id} for target=${plannedLens.targetDurationMs} mutators=${plannedLens.mutators.join(',') || 'none'}`
  );

  const runtime = await LensRuntime.create(plannedLens.lens.plugin, hostBindings, {
    maxFrameMs: 8,
    maxHeapMb: 64,
    deterministicSeed: 42
  });

  return runtime.runFrame(frame);
}

export async function bootstrapHostServer(
  config: Partial<OrchestrationConfig> = {}
): Promise<void> {
  const lensTargetDurationMs = assertLensDuration(config.lensTargetDurationMs ?? 2 * 60 * 1000);
  const seed = config.seed ?? 42;
  const profileId = config.profileId ?? 'default-profile';

  const phases: RunPhase[] = [
    'lobby/nexus',
    'lens-sequence',
    'boss-lens',
    'run-end',
    'meta-progression'
  ];
  const plan = buildRunPlan(seed, lensTargetDurationMs);

  const lobby = createWebSocketLobby();
  await lobby.join('nexus', 'host');

  let currentPhase = phases[0];
  console.log(`phase=${currentPhase} runId=${plan.runId} seed=${plan.seed}`);

  let frame = parseFrame({ tick: 0, entities: [] });

  currentPhase = phases[1];
  console.log(`phase=${currentPhase} runId=${plan.runId}`);
  for (const plannedLens of plan.lensSequence) {
    frame = await runLens(plannedLens, frame);
    frame = parseFrame({ ...frame, tick: frame.tick + 1 });
  }

  currentPhase = phases[2];
  console.log(`phase=${currentPhase} runId=${plan.runId}`);
  frame = await runLens(plan.bossLens, frame);

  currentPhase = phases[3];
  console.log(`phase=${currentPhase} runId=${plan.runId} finalTick=${frame.tick}`);

  currentPhase = phases[4];
  console.log(`phase=${currentPhase} runId=${plan.runId}`);
  const persistence = new InMemoryMetaProgressionPersistence();
  const existingProfile =
    (await persistence.load(profileId)) ??
    createDefaultMetaProfile(profileId, hostBindings.nowMs());
  const rewards: MetaRewardPackage = parseMetaRewardPackage({
    xpGranted: 125,
    unlocks: {
      lenses: ['lens/arcade-skirmish'],
      characters: ['character/tank'],
      mutators: ['mutator/double-enemies'],
      relicStarts: ['relic/smoke-bomb']
    }
  });
  const updatedProfile = applyMetaRewards(existingProfile, rewards, hostBindings.nowMs());
  await persistence.save(updatedProfile);

  console.log(
    `Host server initialized. profile=${updatedProfile.profileId} xp=${updatedProfile.xp}`
  );
}

void bootstrapHostServer();
