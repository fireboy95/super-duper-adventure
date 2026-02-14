import type {
  DeterministicValue,
  EncodeOutput,
  LensPluginV1,
  LifecycleContext,
  PluginManifestV1,
  UpdateInput
} from '../index.js';

export function createPluginStub<
  TDecoded extends DeterministicValue = DeterministicValue,
  TRendered extends DeterministicValue = DeterministicValue
>(manifest: PluginManifestV1): LensPluginV1<TDecoded, TRendered> {
  let latestFrame: EncodeOutput = { tick: 0, entities: [] };

  return {
    manifest,
    init(ctx: LifecycleContext): void {
      void ctx;
    },
    decode(input): TDecoded {
      latestFrame = input;
      return input as TDecoded;
    },
    update(input: UpdateInput<TDecoded>, dt: number): void {
      void input;
      void dt;
    },
    render(): TRendered {
      return { status: 'ok' } as unknown as TRendered;
    },
    encode(): EncodeOutput {
      return latestFrame;
    },
    shutdown(): void {
      // No-op default shutdown.
    }
  };
}
