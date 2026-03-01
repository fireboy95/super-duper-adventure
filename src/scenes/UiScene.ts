import Phaser from 'phaser';
import { LayeredIconMenu, type LayeredMenuNode } from '../game/ui/LayeredIconMenu';

const ROUTE_EVENT = 'ui:navigate';
const DEBUG_TEXTURE_KEY = 'debug-pane-texture';
const MAX_LOG_LINES = 120;

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

export class UiScene extends Phaser.Scene {
  private layeredMenu?: LayeredIconMenu;

  private debugPaneContainer?: Phaser.GameObjects.Container;
  private debugPaneBackground?: Phaser.GameObjects.Rectangle;
  private debugPaneTexture?: Phaser.GameObjects.TileSprite;
  private debugPaneText?: Phaser.GameObjects.Text;
  private debugPaneExitButton?: Phaser.GameObjects.Container;

  private isDebugPaneExpanded = false;
  private debugPaneHeight = 0;
  private readonly debugLogLines: string[] = [];

  private readonly originalConsole: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};
  private originalWindowError?: OnErrorEventHandler | null;
  private originalUnhandledRejection?: Window['onunhandledrejection'];

  constructor() {
    super('ui-scene');
  }

  create(): void {
    this.layeredMenu = new LayeredIconMenu(this, this.buildMenuDefinition());
    this.createDebugMenu();
    this.captureConsoleOutput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_: number, delta: number): void {
    if (!this.debugPaneTexture || !this.isDebugPaneExpanded) {
      return;
    }

    this.debugPaneTexture.tilePositionX += delta * 0.018;
    this.debugPaneTexture.tilePositionY += delta * 0.011;
  }

  private shutdown(): void {
    this.restoreConsoleOutput();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.layeredMenu?.destroy();
    this.layeredMenu = undefined;

    this.debugPaneContainer?.destroy();
    this.debugPaneContainer = undefined;
  }

  private createDebugMenu(): void {
    this.createDebugTexture();

    const { width } = this.scale;
    this.debugPaneBackground = this.add.rectangle(0, 0, width, 0, 0x060708, 0.52).setOrigin(0.5, 0).setStrokeStyle(1, 0x7dc6ff, 0.45);
    this.debugPaneTexture = this.add.tileSprite(0, 0, width, 0, DEBUG_TEXTURE_KEY).setOrigin(0.5, 0).setAlpha(0.28);
    this.debugPaneText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8f0ff',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setPadding(14, 18, 14, 14)
      .setWordWrapWidth(Math.max(200, width - 48));

    this.debugPaneExitButton = this.createDebugPaneExitButton();

    this.debugPaneContainer = this.add.container(width / 2, 28, [
      this.debugPaneBackground,
      this.debugPaneTexture,
      this.debugPaneText,
      this.debugPaneExitButton,
    ]);
    this.debugPaneContainer.setDepth(1000).setScrollFactor(0).setVisible(false);
    this.refreshDebugPaneLayout();
  }

  private createDebugPaneExitButton(): Phaser.GameObjects.Container {
    const buttonWidth = 92;
    const buttonHeight = 30;

    const bg = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x1f3042, 0.92)
      .setStrokeStyle(1, 0x7dc6ff, 0.85)
      .setOrigin(0, 0);

    const label = this.add
      .text(buttonWidth / 2, buttonHeight / 2, 'Exit Debug', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#dff4ff',
      })
      .setOrigin(0.5);

    const hitArea = this.add.zone(0, 0, buttonWidth, buttonHeight).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.setDebugPaneOpen(false));

    return this.add.container(0, 0, [bg, label, hitArea]);
  }

  private createDebugTexture(): void {
    if (this.textures.exists(DEBUG_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.add.graphics();

    graphics.fillStyle(0x17212f, 0.95).fillRect(0, 0, 96, 96);

    for (let i = -96; i < 192; i += 24) {
      graphics.lineStyle(8, 0x2f4b6f, 0.35);
      graphics.lineBetween(i, 0, i + 96, 96);
    }

    for (let i = -96; i < 192; i += 32) {
      graphics.lineStyle(2, 0x82d4ff, 0.22);
      graphics.lineBetween(i, 0, i + 96, 96);
    }

    graphics.generateTexture(DEBUG_TEXTURE_KEY, 96, 96);
    graphics.destroy();
  }

  private handleResize(): void {
    this.refreshDebugPaneLayout();
  }

  private setDebugPaneOpen(isOpen: boolean): void {
    if (!this.debugPaneContainer) {
      return;
    }

    this.isDebugPaneExpanded = isOpen;

    this.debugPaneContainer.setVisible(true);

    const targetHeight = isOpen ? Math.max(180, this.scale.height * 0.72) : 0;

    this.tweens.add({
      targets: this,
      debugPaneHeight: targetHeight,
      duration: 180,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => this.refreshDebugPaneLayout(),
      onComplete: () => {
        if (!this.isDebugPaneExpanded && this.debugPaneContainer) {
          this.debugPaneContainer.setVisible(false);
        }
      },
    });
  }

  private refreshDebugPaneLayout(): void {
    if (
      !this.debugPaneContainer ||
      !this.debugPaneBackground ||
      !this.debugPaneTexture ||
      !this.debugPaneText ||
      !this.debugPaneExitButton
    ) {
      return;
    }

    const { width } = this.scale;

    this.debugPaneContainer.setPosition(width / 2, 28);

    this.debugPaneBackground.setSize(width, this.debugPaneHeight);
    this.debugPaneTexture.setSize(width, this.debugPaneHeight);
    this.debugPaneText
      .setWordWrapWidth(Math.max(200, width - 48))
      .setPosition(0, 0)
      .setCrop(0, 0, width, Math.max(0, this.debugPaneHeight - 8));

    this.debugPaneExitButton.setPosition(width / 2 - 106, 8).setVisible(this.debugPaneHeight > 48);

    this.refreshDebugText();
  }

  private captureConsoleOutput(): void {
    (['log', 'info', 'warn', 'error', 'debug'] as const).forEach((method) => {
      const original = console[method].bind(console);
      this.originalConsole[method] = original;

      console[method] = (...args: unknown[]) => {
        this.appendLog(`[${method}] ${this.formatConsoleArgs(args)}`);
        original(...args);
      };
    });

    this.originalWindowError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.appendLog(`[exception] ${String(message)} (${source}:${lineno}:${colno}) ${error instanceof Error ? error.stack ?? '' : ''}`);
      if (typeof this.originalWindowError === 'function') {
        return this.originalWindowError.call(window, message, source, lineno, colno, error);
      }
      return false;
    };

    this.originalUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      this.appendLog(`[promise] Unhandled rejection: ${this.stringifyArg(event.reason)}`);
      if (this.originalUnhandledRejection) {
        return this.originalUnhandledRejection.call(window, event);
      }
      return undefined;
    };

    this.appendLog('[debug] Debug console initialized.');
  }

  private restoreConsoleOutput(): void {
    (['log', 'info', 'warn', 'error', 'debug'] as const).forEach((method) => {
      const original = this.originalConsole[method];
      if (original) {
        console[method] = original;
      }
    });

    window.onerror = this.originalWindowError ?? null;
    window.onunhandledrejection = this.originalUnhandledRejection ?? null;
  }

  private appendLog(line: string): void {
    this.debugLogLines.push(line);
    if (this.debugLogLines.length > MAX_LOG_LINES) {
      this.debugLogLines.splice(0, this.debugLogLines.length - MAX_LOG_LINES);
    }

    this.refreshDebugText();
  }

  private refreshDebugText(): void {
    if (!this.debugPaneText) {
      return;
    }

    this.debugPaneText.setText(this.debugLogLines.join('\n'));
  }

  private formatConsoleArgs(args: unknown[]): string {
    return args.map((arg) => this.stringifyArg(arg)).join(' ');
  }

  private stringifyArg(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Error) {
      return value.stack ?? `${value.name}: ${value.message}`;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private buildMenuDefinition(): LayeredMenuNode[] {
    return [
      {
        id: 'explore',
        icon: '🧭',
        label: 'Explore',
        color: 0x457b9d,
        children: [
          { id: 'map', icon: '🗺️', label: 'Map', color: 0x3a86ff, onSelect: () => this.navigate('map-scene') },
          { id: 'quests', icon: '📜', label: 'Quests', color: 0x4d908e, onSelect: () => this.navigate('quests-scene') },
          { id: 'home', icon: '🏠', label: 'Home', color: 0x457b9d, onSelect: () => this.navigate('main-scene') },
        ],
      },
      {
        id: 'build',
        icon: '🛠️',
        label: 'Build',
        color: 0x9d4edd,
        children: [
          { id: 'craft', icon: '⚒️', label: 'Craft', color: 0x7b2cbf, onSelect: () => this.navigate('build-scene') },
          { id: 'upgrade', icon: '⬆️', label: 'Upgrade', color: 0x5a189a, onSelect: () => this.navigate('build-scene') },
          { id: 'workshop', icon: '🏗️', label: 'Workshop', color: 0x3c096c, onSelect: () => this.navigate('build-scene') },
        ],
      },
      {
        id: 'social',
        icon: '👥',
        label: 'Social',
        color: 0xff8fab,
        children: [
          { id: 'friends', icon: '🤝', label: 'Friends', color: 0xff6b6b, onSelect: () => this.navigate('social-scene') },
          { id: 'guild', icon: '🛡️', label: 'Guild', color: 0xf06595, onSelect: () => this.navigate('social-scene') },
          { id: 'mail', icon: '✉️', label: 'Messages', color: 0xe64980, onSelect: () => this.navigate('social-scene') },
        ],
      },
      {
        id: 'settings',
        icon: '⚙️',
        label: 'Settings',
        color: 0xf4a261,
        children: [
          { id: 'audio', icon: '🔊', label: 'Audio', color: 0xe76f51, onSelect: () => this.navigate('settings-scene') },
          { id: 'controls', icon: '🎮', label: 'Controls', color: 0xf77f00, onSelect: () => this.navigate('settings-scene') },
          {
            id: 'accessibility',
            icon: '♿',
            label: 'Accessibility',
            color: 0xfc8c29,
            onSelect: () => this.navigate('settings-scene'),
          },
          {
            id: 'debug-pane',
            icon: '🪲',
            label: 'Debug Pane',
            color: 0x577590,
            onSelect: () => this.setDebugPaneOpen(true),
          },
        ],
      },
    ];
  }

  private navigate(sceneKey: string): void {
    this.game.events.emit(ROUTE_EVENT, sceneKey);
  }
}

export { ROUTE_EVENT };
