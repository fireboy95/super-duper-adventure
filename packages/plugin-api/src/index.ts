import type { UFrame } from '@adventure/core-schema';

export const PLUGIN_API_VERSION = '1.0.0' as const;
export type PluginApiVersion = typeof PLUGIN_API_VERSION;

export type DeterministicPrimitive = string | number | boolean | null;
export type DeterministicValue = DeterministicPrimitive | readonly DeterministicValue[] | { readonly [key: string]: DeterministicValue };

export interface HostDeterministicContext {
  readonly nowMs: () => number;
  readonly random: () => number;
  readonly log: (message: string) => void;
  readonly seed: number;
}

export interface ResourceBudgets {
  readonly maxUpdateMs: number;
  readonly maxDecodeMs: number;
  readonly maxEncodeMs: number;
  readonly maxHeapMb: number;
}

export interface PluginManifestV1 {
  readonly apiVersion: PluginApiVersion;
  readonly lensId: string;
  readonly capabilities: readonly string[];
  readonly resourceBudgets: ResourceBudgets;
}

export interface LifecycleContext {
  readonly host: HostDeterministicContext;
  readonly manifest: PluginManifestV1;
}

export type DecodeInput = UFrame;
export type DecodeOutput = DeterministicValue;
export type UpdateInput<TDecoded extends DeterministicValue = DeterministicValue> = TDecoded;
export type EncodeOutput = UFrame;

export interface LensPluginV1<
  TDecoded extends DeterministicValue = DeterministicValue,
  TRenderOutput extends DeterministicValue = DeterministicValue
> {
  readonly manifest: PluginManifestV1;
  init(ctx: LifecycleContext): Promise<void> | void;
  decode(input: DecodeInput): Promise<TDecoded> | TDecoded;
  update(input: UpdateInput<TDecoded>, dt: number): Promise<void> | void;
  render?(): Promise<TRenderOutput> | TRenderOutput;
  encode(): Promise<EncodeOutput> | EncodeOutput;
  shutdown(): Promise<void> | void;
}

export type PluginErrorCode =
  | 'INIT_ERROR'
  | 'DECODE_ERROR'
  | 'UPDATE_ERROR'
  | 'RENDER_ERROR'
  | 'ENCODE_ERROR'
  | 'SHUTDOWN_ERROR'
  | 'TIMEOUT_ERROR'
  | 'MANIFEST_INCOMPATIBLE';

export class PluginLifecycleError extends Error {
  readonly code: PluginErrorCode;
  readonly pluginCause?: unknown;

  constructor(code: PluginErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PluginLifecycleError';
    this.code = code;
    this.pluginCause = cause;
  }
}

export interface TimeoutSemantics {
  readonly initMs: number;
  readonly decodeMs: number;
  readonly updateMs: number;
  readonly renderMs: number;
  readonly encodeMs: number;
  readonly shutdownMs: number;
}

export interface PluginCompatibilityRequirements {
  readonly apiVersion: PluginApiVersion;
  readonly lensId?: string;
  readonly requiredCapabilities?: readonly string[];
  readonly minResourceBudgets?: Partial<ResourceBudgets>;
  readonly maxResourceBudgets?: Partial<ResourceBudgets>;
}

export interface CompatibilityResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function isDeterministicValue(value: unknown): value is DeterministicValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return Number.isFinite(value as number) || typeof value !== 'number';
  }

  if (Array.isArray(value)) {
    return value.every(isDeterministicValue);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isDeterministicValue);
  }

  return false;
}

export { createHostLifecycleBindings } from './generated/host-bindings.js';
export { createPluginStub } from './generated/plugin-stubs.js';
export { assertManifestCompatibility, isManifestCompatible } from './manifest.js';
