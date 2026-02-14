import type { UFrame } from '@adventure/core-schema';
import type { LensPluginV1 } from '@adventure/plugin-api';

let nextFrame: UFrame = { tick: 0, entities: [] };

export const echoLensPlugin: LensPluginV1<UFrame> = {
  manifest: {
    apiVersion: '1.0.0',
    lensId: 'lens/echo',
    capabilities: ['decode', 'update', 'encode', 'render'],
    resourceBudgets: {
      maxUpdateMs: 8,
      maxDecodeMs: 8,
      maxEncodeMs: 8,
      maxHeapMb: 32
    }
  },
  init(ctx) {
    ctx.host.log(`initialized ${ctx.manifest.lensId}`);
  },
  decode(frame: UFrame): UFrame {
    return frame;
  },
  update(input: UFrame): void {
    nextFrame = input;
  },
  render() {
    return { tick: nextFrame.tick, entityCount: nextFrame.entities.length };
  },
  encode(): UFrame {
    return nextFrame;
  },
  shutdown() {
    nextFrame = { tick: 0, entities: [] };
  }
};
