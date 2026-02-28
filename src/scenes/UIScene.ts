import Phaser from 'phaser';
import { DialogEntry, DialogOption, DialogueSystem } from '../systems/DialogueSystem';
import { DebugConsoleEntry, debugConsole } from '../systems/DebugConsole';

export class UIScene extends Phaser.Scene {
  private dialogueSystem = new DialogueSystem();
  private hudText?: Phaser.GameObjects.Text;
  private debugPanel?: Phaser.GameObjects.Container;
  private debugText?: Phaser.GameObjects.Text;
  private debugHintText?: Phaser.GameObjects.Text;
  private debugStatusText?: Phaser.GameObjects.Text;
  private feedButton?: Phaser.GameObjects.Container;
  private cleanButton?: Phaser.GameObjects.Container;
  private debugButton?: Phaser.GameObjects.Container;
  private sweetButton?: Phaser.GameObjects.Container;
  private waterButton?: Phaser.GameObjects.Container;
  private handleButton?: Phaser.GameObjects.Container;
  private feedButtonDisabled = false;
  private sweetButtonDisabled = false;
  private isDebugOpen = false;
  private unsubscribeDebug?: () => void;

  private dialogModal?: Phaser.GameObjects.Container;
  private dialogBackdrop?: Phaser.GameObjects.Rectangle;
  private dialogPanel?: Phaser.GameObjects.Rectangle;
  private dialogTitleText?: Phaser.GameObjects.Text;
  private dialogSpeakerText?: Phaser.GameObjects.Text;
  private dialogPageText?: Phaser.GameObjects.Text;
  private dialogPageIndicatorText?: Phaser.GameObjects.Text;
  private dialogAdvanceButton?: Phaser.GameObjects.Container;
  private dialogOptionButtons: Phaser.GameObjects.Container[] = [];
  private currentDialog: DialogEntry | null = null;
  private currentDialogPage = 0;
  private currentDialogEventId: string | null = null;
  private hudBackground?: Phaser.GameObjects.Rectangle;
  private controlsAreaHeight = 0;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.hudBackground = this.add.rectangle(320, 22, 640, 44, 0x1f1f1f, 0.9);
    this.hudText = this.add.text(16, 10, 'Hunger -- | Thirst -- | Energy -- | Health -- | Cleanliness -- | Mood --', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f7f7f7',
      wordWrap: { width: Math.max(200, this.scale.width - 120) },
      lineSpacing: 2,
    });

    const debugHintCopy = this.sys.game.device.input.touch ? '[DEBUG TAP]' : '[` DEBUG]';
    this.debugHintText = this.add.text(625, 10, debugHintCopy, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff99',
    });
    this.debugHintText.setOrigin(1, 0);
    this.debugHintText.setInteractive({ useHandCursor: true });
    this.debugHintText.on('pointerdown', () => {
      this.toggleDebugPanel();
    });

    this.debugStatusText = this.add.text(16, 30, 'DEBUG: OFF', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff99',
    });

    this.createTouchControls();
    this.createDialogModal();
    this.layoutResponsiveUi(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.createDebugOverlay();
    this.bindDebugToggle();
    this.bindDialogueEvents();
    this.bindHudEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeDebug?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }


  private bindHudEvents(): void {
    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('hud:update', (payload: { hunger: number; thirst: number; energy: number; health: number; cleanliness: number; mood: number; foodStandard?: number; foodSweet?: number }) => {
      this.hudText?.setText(
        `H ${payload.hunger.toFixed(0)}  T ${payload.thirst.toFixed(0)}  E ${payload.energy.toFixed(0)}  HP ${payload.health.toFixed(0)}\nClean ${payload.cleanliness.toFixed(0)}  Mood ${payload.mood.toFixed(0)}`
      );

      this.setActionButtonDisabled(this.feedButton, (payload.foodStandard ?? 0) <= 0, 0x306a43);
      this.setActionButtonDisabled(this.sweetButton, (payload.foodSweet ?? 0) <= 0, 0x6e3e8c);
    });
  }

  private bindDialogueEvents(): void {
    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('dialog:show', (payload: string | { dialogId: string; eventId?: string }) => {
      if (typeof payload === 'string') {
        this.openDialog(payload);
        return;
      }

      this.openDialog(payload.dialogId, payload.eventId);
    });
  }

  private openDialog(dialogId: string, eventId?: string): void {
    const dialog = this.dialogueSystem.getById(dialogId);
    if (!dialog) {
      console.warn(`[dialog] Unknown dialog ID "${dialogId}" requested.`);
      return;
    }

    this.currentDialog = dialog;
    this.currentDialogPage = 0;
    this.currentDialogEventId = eventId ?? null;
    this.dialogBackdrop?.setInteractive();
    this.dialogModal?.setVisible(true);
    this.renderDialog();
    console.info('[dialog]', dialog.id, dialog.title);
  }

  private renderDialog(): void {
    if (!this.currentDialog || !this.dialogTitleText || !this.dialogSpeakerText || !this.dialogPageText || !this.dialogPageIndicatorText) {
      return;
    }

    const totalPages = this.currentDialog.pages.length;
    const isFinalPage = this.currentDialogPage >= totalPages - 1;

    this.dialogTitleText.setText(this.currentDialog.title);
    this.dialogSpeakerText.setText(`Speaker: ${this.currentDialog.speaker}`);
    this.dialogPageText.setText(this.currentDialog.pages[this.currentDialogPage] ?? '...');
    this.dialogPageIndicatorText.setText(`Page ${this.currentDialogPage + 1}/${totalPages}`);

    this.renderDialogOptions(isFinalPage ? this.currentDialog.options : []);
    this.updateAdvanceButton(isFinalPage);
  }

  private renderDialogOptions(options: DialogOption[]): void {
    for (const button of this.dialogOptionButtons) button.destroy();
    this.dialogOptionButtons = [];

    options.forEach((option, index) => {
      const button = this.createModalButton(option.label, 0x284968, () => {
        this.handleOptionSelection(option);
      });
      button.setPosition(0, 118 + index * 44);
      this.dialogModal?.add(button);
      this.dialogOptionButtons.push(button);
    });
  }

  private handleOptionSelection(option: DialogOption): void {
    const cageScene = this.scene.get('CageScene');

    if (!option.effects) {
      console.warn(`[dialog] Option "${option.id}" has no effects payload; closing dialog safely.`);
      this.closeDialog();
      return;
    }

    const optionEffects = structuredClone(option.effects);
    const labelLower = option.label.toLowerCase();
    const shouldMarkIgnore = this.currentDialogEventId && (labelLower.includes('later') || labelLower.includes('ignore'));

    if (shouldMarkIgnore) {
      const progression = optionEffects.progression ?? {};
      const ignoredEventIdsAdd = progression.ignoredEventIdsAdd ?? [];
      if (this.currentDialogEventId && !ignoredEventIdsAdd.includes(this.currentDialogEventId)) {
        ignoredEventIdsAdd.push(this.currentDialogEventId);
      }
      progression.ignoredEventIdsAdd = ignoredEventIdsAdd;
      optionEffects.progression = progression;
      console.debug(`[dialog] Option "${option.id}" marked ignore for event "${this.currentDialogEventId}".`);
    }

    cageScene.events.emit('dialog:apply-effects', optionEffects);

    const followUpDialogId = optionEffects.nextDialogId ?? optionEffects.followUpDialogIds?.[0];
    if (followUpDialogId) {
      this.openDialog(followUpDialogId);
      return;
    }

    this.closeDialog();
  }

  private closeDialog(): void {
    this.currentDialog = null;
    this.currentDialogPage = 0;
    this.currentDialogEventId = null;
    this.renderDialogOptions([]);
    this.dialogBackdrop?.disableInteractive();
    this.dialogModal?.setVisible(false);
  }

  private updateAdvanceButton(isFinalPage: boolean): void {
    if (!this.dialogAdvanceButton) return;

    const labelText = this.dialogAdvanceButton.list[1] as Phaser.GameObjects.Text;
    labelText.setText(isFinalPage ? 'CLOSE' : 'NEXT');

    this.dialogAdvanceButton.removeAllListeners();
    this.dialogAdvanceButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.currentDialog) {
        this.closeDialog();
        return;
      }

      if (isFinalPage) {
        this.closeDialog();
      } else {
        this.currentDialogPage += 1;
        this.renderDialog();
      }
    });
  }

  private createDialogModal(): void {
    this.dialogBackdrop = this.add.rectangle(320, 240, 640, 480, 0x000000, 0.5).setInteractive();
    this.dialogBackdrop.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    this.dialogPanel = this.add.rectangle(320, 240, 520, 320, 0x13161d, 0.94);
    this.dialogPanel.setStrokeStyle(2, 0xc9dbff, 0.9);

    this.dialogTitleText = this.add.text(90, 106, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f7f7f7',
    });

    this.dialogSpeakerText = this.add.text(90, 133, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#bbcae8',
    });

    this.dialogPageText = this.add.text(90, 168, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      wordWrap: { width: 455 },
      lineSpacing: 3,
    });

    this.dialogPageIndicatorText = this.add.text(90, 280, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#9faeca',
    });

    this.dialogAdvanceButton = this.createModalButton('NEXT', 0x474c57, () => undefined);
    this.dialogAdvanceButton.setPosition(0, 146);

    this.dialogModal = this.add.container(0, 0, [
      this.dialogBackdrop,
      this.dialogPanel,
      this.dialogTitleText,
      this.dialogSpeakerText,
      this.dialogPageText,
      this.dialogPageIndicatorText,
      this.dialogAdvanceButton,
    ]);

    this.dialogModal.setDepth(30);
    this.dialogModal.setVisible(false);
    this.dialogBackdrop.disableInteractive();
  }

  private createDebugOverlay(): void {
    const background = this.add.rectangle(320, 140, 620, 220, 0x000000, 0.82);
    background.setStrokeStyle(2, 0x00ff99, 0.75);

    const title = this.add.text(24, 40, 'DEBUG CONSOLE // QUAKE MODE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ff99',
    });

    this.debugText = this.add.text(24, 62, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#d3ffd8',
      wordWrap: { width: 592 },
      lineSpacing: 3,
    });

    this.debugPanel = this.add.container(0, 0, [background, title, this.debugText]);
    this.debugPanel.setVisible(false);

    this.unsubscribeDebug = debugConsole.subscribe((entries) => {
      this.renderDebugEntries(entries);
    });
  }

  private bindDebugToggle(): void {
    const backtickKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    backtickKey?.on('down', () => {
      this.toggleDebugPanel();
    });
  }

  private toggleDebugPanel(): void {
    this.isDebugOpen = !this.isDebugOpen;
    this.debugPanel?.setVisible(this.isDebugOpen);
    this.debugHintText?.setColor(this.isDebugOpen ? '#ffffff' : '#00ff99');
    this.debugStatusText?.setText(`DEBUG: ${this.isDebugOpen ? 'ON' : 'OFF'}`);
    this.debugStatusText?.setColor(this.isDebugOpen ? '#ffffff' : '#00ff99');
    console.log(`[debug] Console ${this.isDebugOpen ? 'opened' : 'closed'}`);
  }

  private renderDebugEntries(entries: DebugConsoleEntry[]): void {
    if (!this.debugText) return;
    const lines = entries
      .slice(-8)
      .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`);

    this.debugText.setText(lines.join('\n'));
  }

  private createTouchControls(): void {
    this.feedButton = this.createActionButton('FEED', 0x306a43, () => {
      if (this.feedButtonDisabled) return;
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:feed');
    });

    this.sweetButton = this.createActionButton('SWEET', 0x6e3e8c, () => {
      if (this.sweetButtonDisabled) return;
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:feed-sweet');
    });

    this.waterButton = this.createActionButton('WATER', 0x2e6f95, () => {
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:refill-water');
    });

    this.handleButton = this.createActionButton('HANDLE', 0x7a5738, () => {
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:handle');
    });

    this.cleanButton = this.createActionButton('CLEAN', 0x365f82, () => {
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:clean');
    });

    this.debugButton = this.createActionButton('DEBUG', 0x5e4168, () => {
      this.sound.play('ui-click', { volume: 0.22 });
      this.toggleDebugPanel();
    });

    this.setActionButtonDisabled(this.feedButton, false, 0x306a43);
    this.setActionButtonDisabled(this.sweetButton, false, 0x6e3e8c);
  }

  private setActionButtonDisabled(button: Phaser.GameObjects.Container | undefined, isDisabled: boolean, enabledColor: number): void {
    if (!button) return;
    const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
    const text = button.list[1] as Phaser.GameObjects.Text | undefined;
    if (!background) return;

    background.disableInteractive();
    if (!isDisabled) {
      background.setInteractive({ useHandCursor: true });
    }

    background.setFillStyle(isDisabled ? 0x3a3a3a : enabledColor, isDisabled ? 0.65 : 0.92);
    text?.setAlpha(isDisabled ? 0.45 : 1);

    if (button === this.feedButton) {
      this.feedButtonDisabled = isDisabled;
    }

    if (button === this.sweetButton) {
      this.sweetButtonDisabled = isDisabled;
    }
  }

  private createActionButton(label: string, color: number, onPress: () => void): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, 136, 44, color, 0.92);
    background.setStrokeStyle(2, 0xeeeeee, 0.9);
    background.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const button = this.add.container(0, 0, [background, text]);
    button.setSize(136, 44);

    background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onPress();
      background.setFillStyle(0x1f1f1f, 0.96);
    });

    background.on('pointerup', () => {
      background.setFillStyle(color, 0.92);
    });

    background.on('pointerout', () => {
      background.setFillStyle(color, 0.92);
    });

    return button;
  }

  private createModalButton(label: string, color: number, onPress: () => void): Phaser.GameObjects.Container {
    const background = this.add.rectangle(320, 0, 420, 34, color, 0.95);
    background.setStrokeStyle(1, 0xe6f0ff, 0.75);
    background.setInteractive({ useHandCursor: true });

    const text = this.add.text(320, 0, label, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const button = this.add.container(0, 0, [background, text]);
    button.setSize(420, 34);

    background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onPress();
      background.setFillStyle(0x1f1f1f, 0.96);
    });

    background.on('pointerup', () => {
      background.setFillStyle(color, 0.95);
    });

    background.on('pointerout', () => {
      background.setFillStyle(color, 0.95);
    });

    return button;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutResponsiveUi(gameSize.width, gameSize.height);
  }

  private layoutResponsiveUi(width: number, height: number): void {
    const isNarrow = width < 900;
    const columns = isNarrow ? 2 : 6;
    const gap = isNarrow ? 10 : 12;
    const sidePadding = isNarrow ? 12 : 14;
    const topPadding = 10;

    const availableWidth = width - sidePadding * 2 - gap * (columns - 1);
    const buttonWidth = Math.max(isNarrow ? 116 : 108, Math.floor(availableWidth / columns));
    const buttonHeight = isNarrow ? 54 : 44;

    const buttons = [this.feedButton, this.sweetButton, this.waterButton, this.handleButton, this.cleanButton, this.debugButton].filter(
      (button): button is Phaser.GameObjects.Container => Boolean(button)
    );

    buttons.forEach((button, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = sidePadding + col * (buttonWidth + gap) + buttonWidth / 2;
      const y = height - 20 - (buttons.length > columns ? (1 - row) * (buttonHeight + gap) : 0);

      const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
      const text = button.list[1] as Phaser.GameObjects.Text | undefined;

      background?.setSize(buttonWidth, buttonHeight);
      text?.setFontSize(isNarrow ? '18px' : '16px');
      button.setSize(buttonWidth, buttonHeight);
      button.setPosition(x, y);
    });

    const controlRows = Math.ceil(buttons.length / columns);
    this.controlsAreaHeight = controlRows * buttonHeight + Math.max(0, controlRows - 1) * gap + 30;

    if (this.hudBackground) {
      const hudHeight = isNarrow ? 68 : 52;
      this.hudBackground.setPosition(width / 2, topPadding + hudHeight / 2);
      this.hudBackground.setSize(width, hudHeight);
    }

    if (this.hudText) {
      this.hudText.setPosition(12, topPadding);
      this.hudText.setStyle({ wordWrap: { width: Math.max(200, width - 130) }, fontSize: isNarrow ? '13px' : '14px' });
    }

    if (this.debugHintText) {
      this.debugHintText.setPosition(width - 12, topPadding);
      this.debugHintText.setFontSize(isNarrow ? '11px' : '12px');
    }

    if (this.debugStatusText) {
      this.debugStatusText.setPosition(12, isNarrow ? 48 : 30);
      this.debugStatusText.setFontSize(isNarrow ? '11px' : '12px');
    }

    this.debugPanel?.setPosition(0, Math.max(0, isNarrow ? 20 : 0));

    const dialogWidth = Math.min(560, width - (isNarrow ? 20 : 28));
    const dialogHeight = Math.min(330, height - this.controlsAreaHeight - (isNarrow ? 24 : 40));
    this.dialogBackdrop?.setPosition(width / 2, height / 2).setSize(width, height);
    this.dialogPanel?.setPosition(width / 2, height / 2 - (isNarrow ? 12 : 0)).setSize(dialogWidth, Math.max(220, dialogHeight));
  }
}
