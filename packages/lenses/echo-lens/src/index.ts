import type { UFrame } from '@adventure/core-schema';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

export const echoLensPlugin: LensPlugin = {
  id: 'lens/echo',
  version: '0.1.0',
  onFrame(frame: UFrame, host: HostBindings): UFrame {
    host.log(`echo lens tick=${frame.tick} entities=${frame.entities.length}`);
    return frame;
  }
};
