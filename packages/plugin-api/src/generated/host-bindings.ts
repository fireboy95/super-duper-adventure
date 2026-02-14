import type {
  DecodeInput,
  HostDeterministicContext,
  LensPluginV1,
  LifecycleContext,
  TimeoutSemantics,
  UpdateInput
} from '../index.js';
import { PluginLifecycleError, isDeterministicValue } from '../index.js';

const DEFAULT_TIMEOUTS: TimeoutSemantics = {
  initMs: 100,
  decodeMs: 8,
  updateMs: 8,
  renderMs: 8,
  encodeMs: 8,
  shutdownMs: 50
};

async function withTimeout<T>(operationName: string, timeoutMs: number, operation: Promise<T> | T): Promise<T> {
  return await Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new PluginLifecycleError('TIMEOUT_ERROR', `${operationName} exceeded timeout (${timeoutMs}ms)`));
      }, timeoutMs);
    })
  ]);
}

export function createHostLifecycleBindings<TDecoded extends UpdateInput>(
  plugin: LensPluginV1<TDecoded>,
  host: HostDeterministicContext,
  timeouts: Partial<TimeoutSemantics> = {}
) {
  const resolvedTimeouts: TimeoutSemantics = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const context: LifecycleContext = { host, manifest: plugin.manifest };

  return {
    async init(): Promise<void> {
      await withTimeout('init', resolvedTimeouts.initMs, plugin.init(context));
    },

    async decode(input: DecodeInput): Promise<TDecoded> {
      const decoded = await withTimeout('decode', resolvedTimeouts.decodeMs, plugin.decode(input));
      if (!isDeterministicValue(decoded)) {
        throw new PluginLifecycleError('DECODE_ERROR', 'decode returned a non-deterministic value');
      }
      return decoded;
    },

    async update(input: TDecoded, dt: number): Promise<void> {
      if (!Number.isFinite(dt) || dt < 0) {
        throw new PluginLifecycleError('UPDATE_ERROR', 'dt must be a non-negative finite number');
      }
      await withTimeout('update', resolvedTimeouts.updateMs, plugin.update(input, dt));
    },

    async render() {
      if (!plugin.render) {
        return undefined;
      }
      const rendered = await withTimeout('render', resolvedTimeouts.renderMs, plugin.render());
      if (!isDeterministicValue(rendered)) {
        throw new PluginLifecycleError('RENDER_ERROR', 'render returned a non-deterministic value');
      }
      return rendered;
    },

    async encode() {
      return await withTimeout('encode', resolvedTimeouts.encodeMs, plugin.encode());
    },

    async shutdown(): Promise<void> {
      await withTimeout('shutdown', resolvedTimeouts.shutdownMs, plugin.shutdown());
    }
  };
}
