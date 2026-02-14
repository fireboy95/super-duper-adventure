import type { UFrame } from '@adventure/core-schema';
import type { HostBindings, LensPlugin } from '@adventure/plugin-api';

export interface RuntimeLimits {
  maxFrameMs: number;
  maxHeapMb: number;
  deterministicSeed: number;
}

export interface RuntimeHandle {
  runFrame(frame: UFrame): Promise<UFrame>;
}

export class LensRuntime {
  constructor(
    private readonly plugin: LensPlugin,
    private readonly host: HostBindings,
    private readonly limits: RuntimeLimits
  ) {}

  async runFrame(frame: UFrame): Promise<UFrame> {
    const start = performance.now();
    const nextFrame = await this.plugin.onFrame(frame, this.host);
    const elapsed = performance.now() - start;

    if (elapsed > this.limits.maxFrameMs) {
      throw new Error(`Lens exceeded frame budget: ${elapsed.toFixed(2)}ms`);
    }

    return nextFrame;
  }

  static async create(plugin: LensPlugin, host: HostBindings, limits: RuntimeLimits): Promise<LensRuntime> {
    if (plugin.init) {
      await plugin.init(host);
    }

    return new LensRuntime(plugin, host, limits);
  }
}
