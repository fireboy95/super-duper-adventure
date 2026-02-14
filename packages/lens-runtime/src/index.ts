import type { UFrame } from '@adventure/core-schema';
import {
  assertManifestCompatibility,
  type HostDeterministicContext,
  type LensPluginV1,
  type PluginCompatibilityRequirements,
  type TimeoutSemantics,
  createHostLifecycleBindings
} from '@adventure/plugin-api';

export interface RuntimeLimits {
  maxFrameMs: number;
  maxHeapMb: number;
  deterministicSeed: number;
}

export class LensRuntime {
  constructor(
    private readonly plugin: LensPluginV1,
    private readonly host: HostDeterministicContext,
    private readonly limits: RuntimeLimits,
    private readonly timeouts: Partial<TimeoutSemantics> = {}
  ) {}

  async runFrame(frame: UFrame): Promise<UFrame> {
    const start = performance.now();
    const lifecycle = createHostLifecycleBindings(this.plugin, this.host, this.timeouts);
    const decoded = await lifecycle.decode(frame);
    await lifecycle.update(decoded, 16.67);
    const nextFrame = await lifecycle.encode();
    const elapsed = performance.now() - start;

    if (elapsed > this.limits.maxFrameMs) {
      throw new Error(`Lens exceeded frame budget: ${elapsed.toFixed(2)}ms`);
    }

    return nextFrame;
  }

  static async create(
    plugin: LensPluginV1,
    host: HostDeterministicContext,
    limits: RuntimeLimits,
    compatibility: PluginCompatibilityRequirements,
    timeouts: Partial<TimeoutSemantics> = {}
  ): Promise<LensRuntime> {
    assertManifestCompatibility(plugin.manifest, compatibility);

    const runtime = new LensRuntime(plugin, host, limits, timeouts);
    const lifecycle = createHostLifecycleBindings(plugin, host, timeouts);
    await lifecycle.init();
    return runtime;
  }

  async shutdown(): Promise<void> {
    const lifecycle = createHostLifecycleBindings(this.plugin, this.host, this.timeouts);
    await lifecycle.shutdown();
  }
}
