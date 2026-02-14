import type { UFrame } from '@adventure/core-schema';

export interface HostBindings {
  nowMs(): number;
  random(): number;
  log(message: string): void;
}

export interface LensPlugin {
  id: string;
  version: string;
  init?(host: HostBindings): Promise<void> | void;
  onFrame(frame: UFrame, host: HostBindings): Promise<UFrame> | UFrame;
}

export interface WasmLensModule {
  instantiate(host: HostBindings): Promise<LensPlugin>;
}

export type WITContractVersion = '0.1.0';

export const WIT_CONTRACT_VERSION: WITContractVersion = '0.1.0';
