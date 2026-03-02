import Phaser from 'phaser';
import { LayeredIconMenu, type LayeredMenuNode } from '../game/ui/LayeredIconMenu';

const ROUTE_EVENT = 'ui:navigate';
export const UI_INPUT_BLOCKED_EVENT = 'ui:input-blocked';
const DEBUG_TEXTURE_KEY = 'debug-pane-texture';
const MAX_LOG_LINES = 120;
const DEFAULT_COMMAND_PLACEHOLDER = 'Type JavaScript and press Enter';
const DEBUG_SCROLL_FOCUS_SUPPRESSION_MS = 180;
const DEBUG_COMMAND_ROW_MIN_WIDTH = 156;
const DEBUG_COMMAND_ROW_HORIZONTAL_MARGIN = 16;
const DEBUG_COMMAND_SUBMIT_BUTTON_WIDTH = 62;
const DEBUG_COMMAND_SUBMIT_BUTTON_GAP = 12;

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

type DebugCommandExecutionResult =
  | { ok: true; value: unknown }
  | { ok: false; error: unknown };

type DebugCommandRunner = (...helpers: unknown[]) => unknown;

const CONSOLE_METHODS: readonly ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

export class UiScene extends Phaser.Scene {
  private layeredMenu?: LayeredIconMenu;

  private debugButtonContainer?: Phaser.GameObjects.Container;
  private debugButtonBackground?: Phaser.GameObjects.Rectangle;
  private debugButtonLabel?: Phaser.GameObjects.Text;
  private debugPaneContainer?: Phaser.GameObjects.Container;
  private debugPaneBackground?: Phaser.GameObjects.Rectangle;
  private debugPaneTexture?: Phaser.GameObjects.TileSprite;
  private debugPaneInteractionShield?: Phaser.GameObjects.Zone;
  private debugPaneScrollHitArea?: Phaser.GameObjects.Zone;
  private debugPaneText?: Phaser.GameObjects.Text;
  private debugCommandInputContainer?: Phaser.GameObjects.Container;
  private debugCommandInputBackground?: Phaser.GameObjects.Rectangle;
  private debugCommandInputText?: Phaser.GameObjects.Text;
  private debugCommandSubmitButton?: Phaser.GameObjects.Container;

  private debugCommandValue = '';
  private debugCommandHiddenInput?: HTMLInputElement;
  private keyboardInset = 0;
  private readonly keyboardInsetThreshold = 80;

  private isDebugPaneExpanded = false;
  private debugPaneHeight = 0;
  private readonly debugLogLines: string[] = [];
  private debugLogScrollOffset = 0;
  private debugLogAutoFollow = true;
  private dragStartY?: number;
  private dragStartOffset = 0;
  private isDraggingDebugPane = false;
  private didDragDebugPane = false;
  private suppressCommandFocusUntil = 0;

  private readonly originalConsole: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};
  private originalWindowError?: OnErrorEventHandler | null;
  private originalUnhandledRejection?: Window['onunhandledrejection'];

  constructor() {
    super('ui-scene');
  }

  create(): void {
    this.layeredMenu = new LayeredIconMenu(this, this.buildMenuDefinition());
    this.initializeDebugTools();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.bindViewportListeners();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private initializeDebugTools(): void {
    try {
      this.createDebugMenu();
      this.captureConsoleOutput();
    } catch (error) {
      console.error('Debug UI initialization failed. Continuing without debug tools.', error);
      this.restoreConsoleOutput();
      this.destroyHiddenCommandInput();
      this.debugButtonContainer?.destroy();
      this.debugButtonContainer = undefined;
      this.debugPaneContainer?.destroy();
      this.debugPaneContainer = undefined;
      this.debugPaneInteractionShield = undefined;
      this.debugPaneScrollHitArea = undefined;
      this.debugPaneText = undefined;
      this.debugCommandInputContainer = undefined;
      this.debugCommandInputBackground = undefined;
      this.debugCommandInputText = undefined;
      this.debugCommandSubmitButton = undefined;
      this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleDebugPaneWheel, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handleGlobalPointerMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalPointerUp, this);
    }
  }

  update(_: number, delta: number): void {
    if (!this.debugPaneTexture || !this.isDebugPaneExpanded) {
      return;
    }

    this.debugPaneTexture.tilePositionX += delta * 0.018;
    this.debugPaneTexture.tilePositionY += delta * 0.011;
  }

  private shutdown(): void {
    this.game.events.emit(UI_INPUT_BLOCKED_EVENT, false);
    this.restoreConsoleOutput();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.unbindViewportListeners();
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleDebugPaneWheel, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handleGlobalPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalPointerUp, this);

    this.layeredMenu?.destroy();
    this.layeredMenu = undefined;

    this.debugButtonContainer?.destroy();
    this.debugButtonContainer = undefined;
    this.debugPaneContainer?.destroy();
    this.debugPaneContainer = undefined;
    this.debugPaneInteractionShield = undefined;
    this.debugPaneScrollHitArea = undefined;
    this.debugCommandInputContainer = undefined;
    this.debugCommandInputBackground = undefined;
    this.debugCommandInputText = undefined;
    this.debugCommandSubmitButton = undefined;

    this.destroyHiddenCommandInput();
  }

  private createDebugMenu(): void {
    this.createDebugTexture();

    const { width } = this.scale;
    const buttonWidth = 88;
    const buttonHeight = 24;

    this.debugButtonBackground = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0.2)
      .setStrokeStyle(1, 0x74c6ff, 0.7)
      .setOrigin(0.5);

    this.debugButtonLabel = this.add
      .text(0, 0, 'Debug', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#bfe7ff',
      })
      .setOrigin(0.5);

    this.debugButtonContainer = this.add.container(width / 2, 14, [this.debugButtonBackground, this.debugButtonLabel]);
    this.debugButtonContainer.setSize(buttonWidth, buttonHeight);
    this.debugButtonContainer.setScrollFactor(0).setDepth(1001);
    this.debugButtonContainer
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.toggleDebugPane());

    this.debugPaneBackground = this.add.rectangle(0, 0, width, 0, 0x060708, 0.64).setOrigin(0.5, 0).setStrokeStyle(1, 0x7dc6ff, 0.45);
    this.debugPaneTexture = this.add.tileSprite(0, 0, width, 0, DEBUG_TEXTURE_KEY).setOrigin(0.5, 0).setAlpha(0.34);
    this.debugPaneInteractionShield = this.add.zone(0, 0, width, 0).setOrigin(0.5, 0);
    this.debugPaneInteractionShield
      .setInteractive()
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
      });
    this.debugPaneScrollHitArea = this.add.zone(0, 0, 0, 0).setOrigin(0, 0);
    this.debugPaneText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8f0ff',
        lineSpacing: 4,
        wordWrap: {
          width: Math.max(200, width - 48),
          useAdvancedWrap: true,
        },
      })
      .setOrigin(0, 0)
      .setPadding(14, 18, 14, 14)
      .setWordWrapWidth(Math.max(200, width - 48));

    this.debugPaneScrollHitArea
      .setInteractive()
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
        this.dragStartY = pointer.y;
        this.dragStartOffset = this.debugLogScrollOffset;
        this.isDraggingDebugPane = true;
        this.didDragDebugPane = false;
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
        this.handleDebugPaneDrag(pointer);
      });

    const initialInputWidth = this.getDebugCommandRowWidth(width);

    this.debugCommandInputBackground = this.add
      .rectangle(0, 0, initialInputWidth, 42, 0x0e2038, 0.88)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x74c6ff, 0.8);
    this.debugCommandInputText = this.add
      .text(0, 0, DEFAULT_COMMAND_PLACEHOLDER, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8bb4d6',
      })
      .setOrigin(0, 0.5);

    const submitBackground = this.add
      .rectangle(0, 0, DEBUG_COMMAND_SUBMIT_BUTTON_WIDTH, 30, 0x16335c, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x74c6ff, 0.8);
    const submitLabel = this.add
      .text(0, 0, 'Run', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#d7efff',
      })
      .setOrigin(0.5);

    this.debugCommandSubmitButton = this.add.container(0, 0, [submitBackground, submitLabel]);
    this.debugCommandSubmitButton
      .setSize(DEBUG_COMMAND_SUBMIT_BUTTON_WIDTH, 30)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
        this.executeCommandFromInput();
      });

    this.debugCommandInputContainer = this.add.container(0, 0, [
      this.debugCommandInputBackground,
      this.debugCommandInputText,
      this.debugCommandSubmitButton,
    ]);
    this.debugCommandInputContainer
      .setSize(initialInputWidth, 42)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.preventDefaultIfSupported(event);
        if (Date.now() < this.suppressCommandFocusUntil) {
          this.blurHiddenCommandInput();
          return;
        }
        this.focusHiddenCommandInputIfAllowed();
      });

    this.debugPaneContainer = this.add.container(width / 2, 28, [
      this.debugPaneBackground,
      this.debugPaneTexture,
      this.debugPaneInteractionShield,
      this.debugPaneScrollHitArea,
      this.debugPaneText,
      this.debugCommandInputContainer,
    ]);
    this.debugPaneContainer.setDepth(1000).setScrollFactor(0).setVisible(false);
    this.refreshDebugPaneLayout();
    this.setupHiddenCommandInput();
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleDebugPaneWheel, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handleGlobalPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handleGlobalPointerUp, this);
    this.refreshDebugCommandText();
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
    this.refreshKeyboardInset();
    this.refreshDebugPaneLayout();
  }

  private bindViewportListeners(): void {
    if (typeof window === 'undefined' || typeof window.visualViewport === 'undefined') {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    viewport.addEventListener('resize', this.handleViewportResize);
    viewport.addEventListener('scroll', this.handleViewportResize);
    this.refreshKeyboardInset();
  }

  private unbindViewportListeners(): void {
    if (typeof window === 'undefined' || typeof window.visualViewport === 'undefined') {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    viewport.removeEventListener('resize', this.handleViewportResize);
    viewport.removeEventListener('scroll', this.handleViewportResize);
  }

  private readonly handleViewportResize = (): void => {
    this.refreshKeyboardInset();
    this.refreshDebugPaneLayout();
  };

  private refreshKeyboardInset(): void {
    if (typeof window === 'undefined') {
      this.keyboardInset = 0;
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      this.keyboardInset = 0;
      return;
    }

    const inset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
    this.keyboardInset = inset >= this.keyboardInsetThreshold ? inset : 0;
  }

  private toggleDebugPane(): void {
    const nextExpandedState = !this.isDebugPaneExpanded;
    this.isDebugPaneExpanded = nextExpandedState;
    this.game.events.emit(UI_INPUT_BLOCKED_EVENT, nextExpandedState);

    if (!this.debugPaneContainer || !this.debugButtonContainer || !this.debugButtonLabel) {
      return;
    }

    this.setDebugPaneInputEnabled(nextExpandedState);

    if (!nextExpandedState) {
      this.suppressCommandFocusUntil = Date.now() + DEBUG_SCROLL_FOCUS_SUPPRESSION_MS;
      this.blurHiddenCommandInput();
    }

    this.debugPaneContainer.setVisible(true);
    this.debugButtonLabel.setText(nextExpandedState ? 'Close' : 'Debug');

    const targetHeight = nextExpandedState ? Math.max(180, this.scale.height * 0.72) : 0;

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
      !this.debugButtonContainer ||
      !this.debugPaneContainer ||
      !this.debugPaneBackground ||
      !this.debugPaneTexture ||
      !this.debugPaneInteractionShield ||
      !this.debugPaneScrollHitArea ||
      !this.debugPaneText ||
      !this.debugCommandInputContainer ||
      !this.debugCommandInputBackground ||
      !this.debugCommandInputText ||
      !this.debugCommandSubmitButton
    ) {
      return;
    }

    const { width } = this.scale;

    this.debugButtonContainer.setPosition(width / 2, 14);
    const upwardOffset = this.isDebugPaneExpanded ? Math.min(this.keyboardInset, this.debugPaneHeight * 0.5) : 0;

    this.debugPaneContainer.setPosition(width / 2, 28 - upwardOffset);

    this.debugPaneBackground.setSize(width, this.debugPaneHeight);
    this.debugPaneTexture.setSize(width, this.debugPaneHeight);
    this.debugPaneInteractionShield.setSize(width, this.debugPaneHeight).setPosition(0, 0);
    if (this.debugPaneInteractionShield.input?.hitArea && 'setTo' in this.debugPaneInteractionShield.input.hitArea) {
      this.debugPaneInteractionShield.input.hitArea.setTo(-width / 2, 0, width, this.debugPaneHeight);
    }
    const textAreaWidth = Math.max(200, width - 48);
    const textAreaHeight = Math.max(0, this.debugPaneHeight - 68);
    this.debugPaneScrollHitArea
      .setSize(textAreaWidth, textAreaHeight)
      .setPosition(-width / 2 + 12, 0);
    if (this.debugPaneScrollHitArea.input?.hitArea && 'setTo' in this.debugPaneScrollHitArea.input.hitArea) {
      this.debugPaneScrollHitArea.input.hitArea.setTo(0, 0, textAreaWidth, textAreaHeight);
    }
    this.debugPaneText
      .setWordWrapWidth(textAreaWidth, true)
      .setFixedSize(textAreaWidth, textAreaHeight)
      .setPosition(-width / 2 + 12, 0)
      .setCrop(0, 0, textAreaWidth, textAreaHeight);

    const inputWidth = this.getDebugCommandRowWidth(width);
    this.debugCommandInputContainer.setSize(inputWidth, 42);
    this.debugCommandInputBackground.setSize(inputWidth, 42);
    this.debugCommandInputContainer.setPosition(0, Math.max(24, this.debugPaneHeight - 30));

    this.debugCommandSubmitButton.setPosition(inputWidth / 2 - (DEBUG_COMMAND_SUBMIT_BUTTON_WIDTH / 2 + 8), 0);
    this.debugCommandInputText.setPosition(-inputWidth / 2 + 12, 0);
    this.refreshHiddenCommandInputLayout(inputWidth, upwardOffset);

    this.refreshDebugText();
  }

  private refreshHiddenCommandInputLayout(inputWidth: number, upwardOffset: number): void {
    if (!this.debugCommandHiddenInput || !this.game.canvas || !this.scale.parentSize) {
      return;
    }

    const canvasBounds = this.game.canvas.getBoundingClientRect();
    const paneTop = 28 - upwardOffset;
    const inputCenterY = Math.max(24, this.debugPaneHeight - 30);
    const inputHeight = 30;
    const inputHorizontalPadding = 6;
    const submitAndGap = DEBUG_COMMAND_SUBMIT_BUTTON_WIDTH + DEBUG_COMMAND_SUBMIT_BUTTON_GAP;

    const left = canvasBounds.left + (this.scale.width - inputWidth) / 2 + inputHorizontalPadding;
    const top = canvasBounds.top + paneTop + inputCenterY - inputHeight / 2;
    const width = Math.max(88, inputWidth - submitAndGap - inputHorizontalPadding * 2);

    this.debugCommandHiddenInput.style.left = `${left}px`;
    this.debugCommandHiddenInput.style.top = `${top}px`;
    this.debugCommandHiddenInput.style.width = `${width}px`;
    this.debugCommandHiddenInput.style.height = `${inputHeight}px`;
  }

  private getDebugCommandRowWidth(sceneWidth: number): number {
    return Math.max(DEBUG_COMMAND_ROW_MIN_WIDTH, sceneWidth - DEBUG_COMMAND_ROW_HORIZONTAL_MARGIN);
  }

  private captureConsoleOutput(): void {
    if (typeof window === 'undefined') {
      return;
    }

    CONSOLE_METHODS.forEach((method) => {
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
    this.appendLog('[debug] Tap the command field, then press Enter (or Run) to execute JavaScript.');
    this.appendLog('[debug] Helpers available: log(...), info(...), warn(...), error(...), debug(...).');
  }

  private setupHiddenCommandInput(): void {
    if (typeof document === 'undefined' || this.debugCommandHiddenInput) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.style.position = 'fixed';
    input.style.left = '0';
    input.style.top = '0';
    input.style.zIndex = '1200';
    input.style.boxSizing = 'border-box';
    input.style.border = '1px solid rgba(116, 198, 255, 0.92)';
    input.style.borderRadius = '4px';
    input.style.background = 'rgba(8, 23, 43, 0.95)';
    input.style.color = '#d7efff';
    input.style.fontFamily = 'monospace';
    input.style.fontSize = '13px';
    input.style.padding = '4px 8px';
    input.style.outline = 'none';
    input.style.webkitAppearance = 'none';

    input.addEventListener('input', this.handleHiddenCommandInput);
    input.addEventListener('keydown', this.handleHiddenCommandKeyDown);
    document.body.appendChild(input);
    this.debugCommandHiddenInput = input;
    this.setDebugPaneInputEnabled(this.isDebugPaneExpanded);
    this.refreshDebugCommandText();
    this.refreshDebugPaneLayout();
  }

  private destroyHiddenCommandInput(): void {
    if (!this.debugCommandHiddenInput) {
      return;
    }

    this.debugCommandHiddenInput.removeEventListener('input', this.handleHiddenCommandInput);
    this.debugCommandHiddenInput.removeEventListener('keydown', this.handleHiddenCommandKeyDown);
    this.debugCommandHiddenInput.remove();
    this.debugCommandHiddenInput = undefined;
  }

  private readonly handleHiddenCommandInput = (): void => {
    if (!this.debugCommandHiddenInput) {
      return;
    }

    this.debugCommandValue = this.debugCommandHiddenInput.value;
    this.refreshDebugCommandText();
  };

  private readonly handleHiddenCommandKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') {
      return;
    }

    this.preventDefaultIfSupported(event);
    this.executeCommandFromInput();
  };

  private preventDefaultIfSupported(event: unknown): void {
    if (typeof event === 'object' && event !== null && 'preventDefault' in event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  }

  private focusHiddenCommandInputIfAllowed(): void {
    if (!this.isDebugPaneExpanded || Date.now() < this.suppressCommandFocusUntil) {
      return;
    }

    this.focusHiddenCommandInput();
  }

  private focusHiddenCommandInput(): void {
    if (!this.isDebugPaneExpanded || !this.debugCommandHiddenInput) {
      return;
    }

    try {
      this.debugCommandHiddenInput.focus({ preventScroll: true });
    } catch (_error) {
      this.debugCommandHiddenInput.focus();
    }
  }

  private setDebugPaneInputEnabled(enabled: boolean): void {
    if (this.debugPaneScrollHitArea?.input) {
      this.debugPaneScrollHitArea.input.enabled = enabled;
    }

    if (this.debugPaneInteractionShield?.input) {
      this.debugPaneInteractionShield.input.enabled = enabled;
    }

    if (this.debugCommandInputContainer?.input) {
      this.debugCommandInputContainer.input.enabled = enabled;
    }

    if (this.debugCommandSubmitButton?.input) {
      this.debugCommandSubmitButton.input.enabled = enabled;
    }

    if (this.debugCommandHiddenInput) {
      this.debugCommandHiddenInput.disabled = !enabled;
      this.debugCommandHiddenInput.style.pointerEvents = enabled ? 'auto' : 'none';
      this.debugCommandHiddenInput.style.visibility = enabled ? 'visible' : 'hidden';
      this.debugCommandHiddenInput.tabIndex = enabled ? 0 : -1;
    }
  }

  private blurHiddenCommandInput(): void {
    this.debugCommandHiddenInput?.blur();
  }

  private executeCommandFromInput(): void {
    const trimmedCommand = this.debugCommandValue.trim();
    if (!trimmedCommand) {
      this.appendLog('[command] Empty command.');
      return;
    }

    try {
      this.appendLog(`> ${trimmedCommand}`);

      const execution = this.executeDebugCommand(trimmedCommand);

      if (!execution.ok) {
        this.appendLog(`[error] ${this.stringifyArg(execution.error)}`);
        return;
      }

      const { value: result } = execution;

      if (result instanceof Promise) {
        this.appendLog('[result] <Promise pending>');
        void result
          .then((resolvedValue) => {
            this.appendLog(`[result:resolved] ${this.stringifyArg(resolvedValue)}`);
          })
          .catch((error) => {
            this.appendLog(`[error] ${this.stringifyArg(error)}`);
          });
      } else {
        this.appendLog(`[result] ${this.stringifyArg(result)}`);
      }
    } catch (error) {
      this.appendLog(`[error] ${this.stringifyArg(error)}`);
    } finally {
      this.debugCommandValue = '';
      if (this.debugCommandHiddenInput) {
        this.debugCommandHiddenInput.value = '';
      }
      this.refreshDebugCommandText();
      this.ensureDebugCommandInputReady();
      this.refocusHiddenCommandInput();
    }
  }

  private ensureDebugCommandInputReady(): void {
    if (!this.isDebugPaneExpanded) {
      return;
    }

    this.setDebugPaneInputEnabled(true);
  }

  private refreshDebugCommandText(): void {
    if (this.debugCommandHiddenInput && this.debugCommandHiddenInput.value !== this.debugCommandValue) {
      this.debugCommandHiddenInput.value = this.debugCommandValue;
    }

    if (!this.debugCommandInputText) {
      return;
    }

    if (this.debugCommandValue.trim().length === 0) {
      this.debugCommandInputText.setText(DEFAULT_COMMAND_PLACEHOLDER).setColor('#8bb4d6');
      return;
    }

    this.debugCommandInputText.setText(this.debugCommandValue).setColor('#d7efff');
  }

  private executeDebugCommand(command: string): DebugCommandExecutionResult {
    const expressionBody = `const console = consoleRef; return (${command});`;
    const statementBody = `const console = consoleRef; ${command}`;

    const expressionCompile = this.compileDebugCommandRunner(expressionBody);
    const compiledRunner = expressionCompile.ok ? expressionCompile : this.compileDebugCommandRunner(statementBody);

    if (!compiledRunner.ok) {
      return { ok: false, error: compiledRunner.error };
    }

    try {
      return {
        ok: true,
        value: compiledRunner.runner(
          this,
          this.game,
          Phaser,
          console,
          console.log.bind(console),
          console.info.bind(console),
          console.warn.bind(console),
          console.error.bind(console),
          console.debug.bind(console),
        ),
      };
    } catch (error) {
      return { ok: false, error };
    }
  }

  private compileDebugCommandRunner(body: string): { ok: true; runner: DebugCommandRunner } | { ok: false; error: unknown } {
    try {
      const runner = new Function(
        'scene',
        'game',
        'Phaser',
        'consoleRef',
        'log',
        'info',
        'warn',
        'error',
        'debug',
        body,
      ) as DebugCommandRunner;

      return { ok: true, runner };
    } catch (error) {
      return { ok: false, error };
    }
  }

  private refocusHiddenCommandInput(): void {
    this.focusAndPrimeHiddenCommandInput();

    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.focusAndPrimeHiddenCommandInput(), 0);
      window.requestAnimationFrame(() => this.focusAndPrimeHiddenCommandInput());
    }
  }

  private focusAndPrimeHiddenCommandInput(): void {
    if (!this.debugCommandHiddenInput) {
      return;
    }

    this.debugCommandHiddenInput.disabled = false;
    this.focusHiddenCommandInput();

    const valueLength = this.debugCommandHiddenInput.value.length;
    this.debugCommandHiddenInput.setSelectionRange(valueLength, valueLength);
  }

  private restoreConsoleOutput(): void {
    CONSOLE_METHODS.forEach((method) => {
      const original = this.originalConsole[method];
      if (original) {
        console[method] = original;
      }
    });

    if (typeof window === 'undefined') {
      return;
    }

    window.onerror = this.originalWindowError ?? null;
    window.onunhandledrejection = this.originalUnhandledRejection ?? null;
  }

  private appendLog(line: string): void {
    const shouldStickToBottom = this.debugLogAutoFollow;

    this.debugLogLines.push(line);
    if (this.debugLogLines.length > MAX_LOG_LINES) {
      this.debugLogLines.splice(0, this.debugLogLines.length - MAX_LOG_LINES);
    }

    if (shouldStickToBottom) {
      this.debugLogScrollOffset = this.getMaxDebugLogOffset();
      this.debugLogAutoFollow = true;
    } else {
      this.debugLogScrollOffset = Math.min(this.debugLogScrollOffset, this.getMaxDebugLogOffset());
    }

    this.refreshDebugText();
  }

  private refreshDebugText(): void {
    if (!this.debugPaneText) {
      return;
    }

    const visibleLineCount = this.getVisibleDebugLineCount();
    const maxOffset = this.getMaxDebugLogOffset(visibleLineCount);
    this.debugLogScrollOffset = Phaser.Math.Clamp(this.debugLogScrollOffset, 0, maxOffset);
    const visibleLines = this.debugLogLines.slice(this.debugLogScrollOffset, this.debugLogScrollOffset + visibleLineCount);

    this.debugPaneText.setText(visibleLines.join('\n'));
  }


  private handleDebugPaneDrag(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.dragStartY === undefined || !this.isDraggingDebugPane) {
      return;
    }

    if (!this.didDragDebugPane && Math.abs(pointer.y - this.dragStartY) >= 6) {
      this.didDragDebugPane = true;
    }

    const estimatedLineHeight = this.getDebugLogLineHeight();
    const movedLines = Math.round((pointer.y - this.dragStartY) / estimatedLineHeight);
    this.setDebugLogScrollOffset(this.dragStartOffset + movedLines);
  }

  private readonly handleGlobalPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isDraggingDebugPane) {
      return;
    }

    this.handleDebugPaneDrag(pointer);
  };

  private readonly handleGlobalPointerUp = (): void => {
    if (this.isDraggingDebugPane && this.didDragDebugPane) {
      this.suppressCommandFocusUntil = Date.now() + DEBUG_SCROLL_FOCUS_SUPPRESSION_MS;
      this.blurHiddenCommandInput();
    }

    this.dragStartY = undefined;
    this.isDraggingDebugPane = false;
    this.didDragDebugPane = false;
  };

  private readonly handleDebugPaneWheel = (
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void => {
    void pointer;
    void deltaX;

    if (!this.isDebugPaneExpanded || !this.debugPaneScrollHitArea || currentlyOver.length === 0) {
      return;
    }

    if (!currentlyOver.includes(this.debugPaneScrollHitArea)) {
      return;
    }

    const lineStep = deltaY === 0 ? 0 : Math.sign(deltaY) * Math.max(1, Math.round(Math.abs(deltaY) / 36));
    if (lineStep === 0) {
      return;
    }

    this.suppressCommandFocusUntil = Date.now() + DEBUG_SCROLL_FOCUS_SUPPRESSION_MS;
    this.blurHiddenCommandInput();
    this.setDebugLogScrollOffset(this.debugLogScrollOffset + lineStep);
  };

  private setDebugLogScrollOffset(nextOffset: number): void {
    const clampedOffset = Phaser.Math.Clamp(nextOffset, 0, this.getMaxDebugLogOffset());
    this.debugLogAutoFollow = clampedOffset >= this.getMaxDebugLogOffset();

    if (clampedOffset === this.debugLogScrollOffset) {
      return;
    }

    this.debugLogScrollOffset = clampedOffset;
    this.refreshDebugText();
  }

  private getVisibleDebugLineCount(): number {
    const availableLogAreaHeight = Math.max(0, this.debugPaneHeight - 68);
    const estimatedLineHeight = this.getDebugLogLineHeight();
    return Math.max(1, Math.floor(availableLogAreaHeight / estimatedLineHeight));
  }

  private getDebugLogLineHeight(): number {
    const fallbackLineHeight = 18;
    if (!this.debugPaneText) {
      return fallbackLineHeight;
    }

    const fontSize = Number.parseFloat(String(this.debugPaneText.style.fontSize));
    const lineSpacing = Number.isFinite(this.debugPaneText.lineSpacing) ? this.debugPaneText.lineSpacing : 0;
    if (!Number.isFinite(fontSize) || fontSize <= 0) {
      return fallbackLineHeight;
    }

    return Math.max(1, fontSize + lineSpacing);
  }

  private getMaxDebugLogOffset(visibleLineCount = this.getVisibleDebugLineCount()): number {
    return Math.max(0, this.debugLogLines.length - visibleLineCount);
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
      try {
        return String(value);
      } catch {
        return '[unstringifiable value]';
      }
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
        ],
      },
    ];
  }

  private navigate(sceneKey: string): void {
    this.game.events.emit(ROUTE_EVENT, sceneKey);
  }
}
export { ROUTE_EVENT };
