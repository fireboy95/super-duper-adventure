export type DebugConsoleEntry = {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
  message: string;
};

type ConsoleMethodName = 'log' | 'info' | 'warn' | 'error' | 'debug';

class DebugConsoleStore {
  private readonly entries: DebugConsoleEntry[] = [];
  private readonly maxEntries = 200;
  private listeners = new Set<(entries: DebugConsoleEntry[]) => void>();
  private isPatched = false;

  install(): void {
    if (this.isPatched) return;
    this.isPatched = true;

    const methods: ConsoleMethodName[] = ['log', 'info', 'warn', 'error', 'debug'];
    for (const method of methods) {
      const original = console[method].bind(console);
      console[method] = (...args: unknown[]) => {
        this.push(method, args);
        original(...args);
      };
    }

    this.push('info', ['Debug console ready. Press ` (backtick) to toggle.']);
  }

  subscribe(listener: (entries: DebugConsoleEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.entries);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private push(level: ConsoleMethodName, args: unknown[]): void {
    const message = args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    this.entries.push({
      level,
      timestamp: new Date().toLocaleTimeString(),
      message,
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    for (const listener of this.listeners) {
      listener(this.entries);
    }
  }
}

export const debugConsole = new DebugConsoleStore();
