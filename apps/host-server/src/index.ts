import { parseFrame, parseUniverseState, type UFrame } from '@adventure/core-schema';
import { LensRuntime, transitionLens, type LensMappingRegistry } from '@adventure/lens-runtime';
import { createWebSocketLobby } from '@adventure/net';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

const hostBindings: HostBindings = {
  nowMs: () => Date.now(),
  random: () => Math.random(),
  log: (message: string) => console.log(`[lens] ${message}`)
};

const passThroughLens: LensPlugin = {
  id: 'builtin/pass-through',
  version: '0.1.0',
  onFrame(frame: UFrame) {
    return parseFrame(frame);
  }
};

const transitionRegistry: LensMappingRegistry = {
  decodeMap: {
    'builtin/pass-through': (input, context) => ({
      frame: input.frame,
      state: {
        frameTick: input.frame.tick,
        priorLens: context.fromLensId
      },
      outcomes: {
        entityCount: input.frame.entities.length,
        transitionedAtTick: input.tick
      }
    })
  },
  encodeMap: {
    'lens/combat': (decoded, context) => ({
      tick: context.tick + 1,
      lensStates: {
        [context.toLensId]: {
          ...((decoded.state as Record<string, unknown>) ?? {}),
          mode: 'combat'
        }
      },
      lensOutcomes: {
        [context.toLensId]: {
          ...((decoded.outcomes as Record<string, unknown>) ?? {}),
          damagePreview: 0
        }
      }
    })
  }
};

export async function bootstrapHostServer(): Promise<void> {
  const lobby = createWebSocketLobby();
  await lobby.join('default', 'host');

  const runtime = await LensRuntime.create(passThroughLens, hostBindings, {
    maxFrameMs: 8,
    maxHeapMb: 64,
    deterministicSeed: 42
  });

  const baselineU = parseUniverseState({
    tick: 0,
    activeLensId: 'builtin/pass-through',
    frame: { tick: 0, entities: [] },
    anchors: {
      hp: 100,
      inventory: ['torch', 'potion'],
      relics: ['sun-stone'],
      flags: { tutorialComplete: true }
    },
    lensStates: {
      'builtin/pass-through': {}
    },
    lensOutcomes: {}
  });

  const transitioned = transitionLens(baselineU, 'lens/combat', transitionRegistry);
  await runtime.runFrame(transitioned.nextU.frame);

  console.log('Host server initialized with authoritative run-state runtime and lens transitions.');
}

void bootstrapHostServer();
