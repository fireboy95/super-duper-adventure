import { parseFrame, type UFrame } from '@adventure/core-schema';
import { LensRuntime } from '@adventure/lens-runtime';
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

export async function bootstrapHostServer(): Promise<void> {
  const lobby = createWebSocketLobby();
  await lobby.join('default', 'host');

  const runtime = await LensRuntime.create(passThroughLens, hostBindings, {
    maxFrameMs: 8,
    maxHeapMb: 64,
    deterministicSeed: 42
  });

  const initialFrame = parseFrame({ tick: 0, entities: [] });
  await runtime.runFrame(initialFrame);

  console.log('Host server initialized with authoritative run-state runtime.');
}

void bootstrapHostServer();
