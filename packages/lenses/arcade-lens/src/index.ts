import type { UFrame } from '@adventure/core-schema';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

export const arcadeLensPlugin: LensPlugin = {
  id: 'lens/arcade-skirmish',
  version: '0.1.0',
  onFrame(frame: UFrame, host: HostBindings): UFrame {
    host.log(`arcade skirmish processing tick=${frame.tick}`);
    return frame;
  }
};
