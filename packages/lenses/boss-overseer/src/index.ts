import type { UFrame } from '@adventure/core-schema';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

export const bossOverseerPlugin: LensPlugin = {
  id: 'boss/overseer-prototype',
  version: '0.1.0',
  onFrame(frame: UFrame, host: HostBindings): UFrame {
    host.log(`boss overseer processing tick=${frame.tick}`);
    return frame;
  }
};
