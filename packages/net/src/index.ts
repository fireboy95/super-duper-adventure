import type { UFrame } from '@adventure/core-schema';

export interface RealtimePeer {
  sendFrame(frame: UFrame): Promise<void>;
  onFrame(handler: (frame: UFrame) => void): void;
}

export interface LobbyTransport {
  join(lobbyId: string, clientId: string): Promise<void>;
  broadcast(message: string): Promise<void>;
}

export function createWebRtcPeer(): RealtimePeer {
  return {
    async sendFrame(frame: UFrame): Promise<void> {
      void frame;
      // placeholder for RTCDataChannel wire format
    },
    onFrame(handler: (frame: UFrame) => void): void {
      void handler;
      // placeholder for inbound RTC wiring
    }
  };
}

export function createWebSocketLobby(): LobbyTransport {
  return {
    async join(lobbyId: string, clientId: string): Promise<void> {
      void lobbyId;
      void clientId;
      // placeholder for websocket session registration
    },
    async broadcast(message: string): Promise<void> {
      void message;
      // placeholder for lobby fan-out
    }
  };
}
