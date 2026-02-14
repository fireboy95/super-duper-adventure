import type { UFrame } from '@adventure/core-schema';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

export const stealthLensPlugin: LensPlugin = {
  id: 'lens/stealth-infiltration',
  version: '0.1.0',
  onFrame(frame: UFrame, host: HostBindings): UFrame {
    host.log(`stealth infiltration processing tick=${frame.tick}`);
    return frame;
  }
};
