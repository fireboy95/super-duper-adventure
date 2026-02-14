import { parseFrame, type UFrame } from '@adventure/core-schema';
import { LensRuntime } from '@adventure/lens-runtime';
import { createWebSocketLobby } from '@adventure/net';
import type { HostDeterministicContext, LensPluginV1 } from '@adventure/plugin-api';

const hostBindings: HostDeterministicContext = {
  nowMs: () => Date.now(),
  random: () => Math.random(),
  log: (message: string) => console.log(`[lens] ${message}`),
  seed: 42
};

const passThroughLens: LensPluginV1<UFrame> = {
  manifest: {
    apiVersion: '1.0.0',
    lensId: 'builtin/pass-through',
    capabilities: ['decode', 'update', 'encode'],
    resourceBudgets: {
      maxUpdateMs: 8,
      maxDecodeMs: 8,
      maxEncodeMs: 8,
      maxHeapMb: 64
    }
  },
  init() {
    // no-op
  },
  decode(frame: UFrame): UFrame {
    return parseFrame(frame);
  },
  update() {
    // no-op
  },
  encode(): UFrame {
    return parseFrame({ tick: 0, entities: [] });
  },
  shutdown() {
    // no-op
  }
};

export async function bootstrapHostServer(): Promise<void> {
  const lobby = createWebSocketLobby();
  await lobby.join('default', 'host');

  const runtime = await LensRuntime.create(
    passThroughLens,
    hostBindings,
    {
      maxFrameMs: 8,
      maxHeapMb: 64,
      deterministicSeed: 42
    },
    {
      apiVersion: '1.0.0',
      requiredCapabilities: ['decode', 'update', 'encode'],
      maxResourceBudgets: { maxHeapMb: 128 }
    }
  );

  const initialFrame = parseFrame({ tick: 0, entities: [] });
  await runtime.runFrame(initialFrame);
  await runtime.shutdown();

  console.log('Host server initialized with authoritative run-state runtime.');
}

void bootstrapHostServer();
