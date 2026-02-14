import { parseFrame, type UEntityState, type UFrame } from '@adventure/core-schema';
import { LensRuntime } from '@adventure/lens-runtime';
import {
  compareInputMessages,
  createWebRtcPeer,
  createWebSocketLobby,
  type AckMessage,
  type ClientInputPayload,
  type InputMessage,
  type SnapshotMessage
} from '@adventure/net';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

interface DeltaU {
  upserts: UEntityState[];
  removals: string[];
}

class AuthoritativeStateMachine {
  private canonicalU: UFrame;
  private pendingInputs: InputMessage[] = [];
  private readonly lastAppliedInputSeq = new Map<string, number>();

  constructor(initial: UFrame) {
    this.canonicalU = parseFrame(initial);
  }

  enqueueInput(message: InputMessage): AckMessage {
    const latestAck = this.lastAppliedInputSeq.get(message.clientId) ?? -1;
    if (message.inputSeq <= latestAck) {
      return {
        type: 'ack',
        roomId: message.roomId,
        clientId: message.clientId,
        ackedInputSeq: latestAck,
        hostTick: this.canonicalU.tick
      };
    }

    this.pendingInputs.push(message);

    return {
      type: 'ack',
      roomId: message.roomId,
      clientId: message.clientId,
      ackedInputSeq: message.inputSeq,
      hostTick: this.canonicalU.tick
    };
  }

  reconcileToTick(targetTick: number): UFrame {
    const sorted = [...this.pendingInputs].sort(compareInputMessages);
    const remaining: InputMessage[] = [];

    for (const message of sorted) {
      if (message.targetTick > targetTick) {
        remaining.push(message);
        continue;
      }

      const latestAck = this.lastAppliedInputSeq.get(message.clientId) ?? -1;
      if (message.inputSeq <= latestAck) {
        continue;
      }

      const delta = this.inputToDelta(message.clientId, message.targetTick, message.payload);
      this.applyDelta(delta, message.targetTick);
      this.lastAppliedInputSeq.set(message.clientId, message.inputSeq);
    }

    this.pendingInputs = remaining;
    return this.canonicalU;
  }

  snapshot(roomId: string): SnapshotMessage {
    const seqByClient: Record<string, number> = {};
    for (const [clientId, seq] of [...this.lastAppliedInputSeq.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      seqByClient[clientId] = seq;
    }

    return {
      type: 'snapshot',
      roomId,
      hostTick: this.canonicalU.tick,
      frame: parseFrame(this.canonicalU),
      lastAppliedInputSeq: seqByClient
    };
  }

  private inputToDelta(clientId: string, tick: number, payload: ClientInputPayload): DeltaU {
    const currentById = new Map(this.canonicalU.entities.map((entity) => [entity.id, entity]));
    const existing = currentById.get(clientId);

    const base: UEntityState =
      existing ?? {
        id: clientId,
        kind: 'player',
        pos: { x: 0, y: 0 },
        tick
      };

    const upsert: UEntityState = {
      ...base,
      tick,
      pos: {
        x: base.pos.x + payload.move.x,
        y: base.pos.y + payload.move.y
      }
    };

    return { upserts: [upsert], removals: [] };
  }

  private applyDelta(delta: DeltaU, tick: number): void {
    const nextById = new Map(this.canonicalU.entities.map((entity) => [entity.id, entity]));

    for (const removalId of delta.removals) {
      nextById.delete(removalId);
    }

    for (const upsert of delta.upserts) {
      nextById.set(upsert.id, upsert);
    }

    this.canonicalU = parseFrame({
      tick,
      entities: [...nextById.values()].sort((a, b) => a.id.localeCompare(b.id))
    });
  }
}

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
  const roomId = 'default';
  const lobby = createWebSocketLobby();
  const rtc = createWebRtcPeer();

  await lobby.createRoom(roomId);
  await lobby.joinRoom({ type: 'join', roomId, clientId: 'host', displayName: 'Host' });
  await lobby.setReady(roomId, 'host', true);
  await lobby.startLens(roomId, passThroughLens.id, 0);

  const runtime = await LensRuntime.create(passThroughLens, hostBindings, {
    maxFrameMs: 8,
    maxHeapMb: 64,
    deterministicSeed: 42
  });

  const stateMachine = new AuthoritativeStateMachine(parseFrame({ tick: 0, entities: [] }));

  rtc.onInput((message) => {
    void lobby
      .broadcast(roomId, stateMachine.enqueueInput(message))
      .catch((error: unknown) => console.error('Failed to publish ack', error));
  });

  const snapshotIntervalMs = 250;
  const snapshotTimer = setInterval(() => {
    const nextTick = stateMachine.snapshot(roomId).hostTick + 1;
    const reconciledFrame = stateMachine.reconcileToTick(nextTick);

    void runtime
      .runFrame(reconciledFrame)
      .then(() => lobby.broadcast(roomId, stateMachine.snapshot(roomId)))
      .catch((error: unknown) => console.error('Host reconciliation failed', error));
  }, snapshotIntervalMs);

  snapshotTimer.unref();

  await rtc.sendInput({
    type: 'input',
    roomId,
    clientId: 'host',
    inputSeq: 0,
    targetTick: 1,
    payload: { move: { x: 1, y: 0 } }
  });

  console.log('Host server initialized with authoritative state machine, lobby, and reconciliation loop.');
}

void bootstrapHostServer();
