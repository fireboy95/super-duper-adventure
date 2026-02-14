import type { UFrame, UVec2 } from '@adventure/core-schema';

export type LensPhase = 'lobby' | 'running' | 'ended';

export interface JoinMessage {
  type: 'join';
  roomId: string;
  clientId: string;
  displayName?: string;
}

export interface ClientInputPayload {
  move: UVec2;
}

export interface InputMessage {
  type: 'input';
  roomId: string;
  clientId: string;
  inputSeq: number;
  targetTick: number;
  payload: ClientInputPayload;
}

export interface AckMessage {
  type: 'ack';
  roomId: string;
  clientId: string;
  ackedInputSeq: number;
  hostTick: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  roomId: string;
  hostTick: number;
  frame: UFrame;
  lastAppliedInputSeq: Record<string, number>;
}

export interface LensTransitionMessage {
  type: 'lens-transition';
  roomId: string;
  from: LensPhase;
  to: LensPhase;
  lensId: string;
  atTick: number;
}

export type ProtocolMessage =
  | JoinMessage
  | InputMessage
  | AckMessage
  | SnapshotMessage
  | LensTransitionMessage;

export interface RealtimePeer {
  sendInput(message: InputMessage): Promise<void>;
  onInput(handler: (message: InputMessage) => void): void;
}

export interface LobbyMember {
  clientId: string;
  displayName?: string;
  ready: boolean;
}

export interface LobbyRoom {
  roomId: string;
  phase: LensPhase;
  lensId?: string;
  members: LobbyMember[];
}

export interface LobbyTransport {
  createRoom(roomId: string): Promise<LobbyRoom>;
  joinRoom(message: JoinMessage): Promise<LobbyRoom>;
  leaveRoom(roomId: string, clientId: string): Promise<LobbyRoom>;
  setReady(roomId: string, clientId: string, ready: boolean): Promise<LobbyRoom>;
  startLens(roomId: string, lensId: string, atTick: number): Promise<LensTransitionMessage>;
  broadcast(roomId: string, message: ProtocolMessage): Promise<void>;
  onBroadcast(handler: (roomId: string, message: ProtocolMessage) => void): void;
}

interface InternalRoom {
  phase: LensPhase;
  lensId?: string;
  members: Map<string, LobbyMember>;
}

export function compareInputMessages(a: InputMessage, b: InputMessage): number {
  if (a.targetTick !== b.targetTick) {
    return a.targetTick - b.targetTick;
  }

  const byClient = a.clientId.localeCompare(b.clientId);
  if (byClient !== 0) {
    return byClient;
  }

  return a.inputSeq - b.inputSeq;
}

export function orderInputMessages(messages: readonly InputMessage[]): InputMessage[] {
  return [...messages].sort(compareInputMessages);
}

export function createWebRtcPeer(): RealtimePeer {
  let inputHandler: ((message: InputMessage) => void) | undefined;

  return {
    async sendInput(message: InputMessage): Promise<void> {
      inputHandler?.(message);
    },
    onInput(handler: (message: InputMessage) => void): void {
      inputHandler = handler;
    }
  };
}

export function createWebSocketLobby(): LobbyTransport {
  const rooms = new Map<string, InternalRoom>();
  let broadcastHandler: ((roomId: string, message: ProtocolMessage) => void) | undefined;

  function toLobbyRoom(roomId: string, room: InternalRoom): LobbyRoom {
    return {
      roomId,
      phase: room.phase,
      lensId: room.lensId,
      members: [...room.members.values()].sort((a, b) => a.clientId.localeCompare(b.clientId))
    };
  }

  function getOrCreateRoom(roomId: string): InternalRoom {
    const existing = rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const created: InternalRoom = {
      phase: 'lobby',
      members: new Map<string, LobbyMember>()
    };
    rooms.set(roomId, created);
    return created;
  }

  return {
    async createRoom(roomId: string): Promise<LobbyRoom> {
      const room = getOrCreateRoom(roomId);
      return toLobbyRoom(roomId, room);
    },
    async joinRoom(message: JoinMessage): Promise<LobbyRoom> {
      const room = getOrCreateRoom(message.roomId);
      room.members.set(message.clientId, {
        clientId: message.clientId,
        displayName: message.displayName,
        ready: false
      });
      return toLobbyRoom(message.roomId, room);
    },
    async leaveRoom(roomId: string, clientId: string): Promise<LobbyRoom> {
      const room = getOrCreateRoom(roomId);
      room.members.delete(clientId);
      return toLobbyRoom(roomId, room);
    },
    async setReady(roomId: string, clientId: string, ready: boolean): Promise<LobbyRoom> {
      const room = getOrCreateRoom(roomId);
      const member = room.members.get(clientId);
      if (!member) {
        throw new Error(`Cannot set ready state for unknown client: ${clientId}`);
      }

      room.members.set(clientId, { ...member, ready });
      return toLobbyRoom(roomId, room);
    },
    async startLens(roomId: string, lensId: string, atTick: number): Promise<LensTransitionMessage> {
      const room = getOrCreateRoom(roomId);
      if (room.members.size === 0) {
        throw new Error('Cannot start lens with an empty room');
      }

      for (const member of room.members.values()) {
        if (!member.ready) {
          throw new Error('Cannot start lens until all members are ready');
        }
      }

      const transition: LensTransitionMessage = {
        type: 'lens-transition',
        roomId,
        from: room.phase,
        to: 'running',
        lensId,
        atTick
      };

      room.phase = 'running';
      room.lensId = lensId;
      broadcastHandler?.(roomId, transition);
      return transition;
    },
    async broadcast(roomId: string, message: ProtocolMessage): Promise<void> {
      broadcastHandler?.(roomId, message);
    },
    onBroadcast(handler: (roomId: string, message: ProtocolMessage) => void): void {
      broadcastHandler = handler;
    }
  };
}
