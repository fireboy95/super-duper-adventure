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

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.add.rectangle(320, 22, 640, 44, 0x1f1f1f, 0.9);
    this.hudText = this.add.text(16, 10, 'Hunger -- | Thirst -- | Energy -- | Health -- | Cleanliness -- | Mood --', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f7f7f7',
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
    cageScene.events.on('hud:update', (payload: { hunger: number; thirst: number; energy: number; health: number; cleanliness: number; mood: number }) => {
      this.hudText?.setText(
        `Hunger ${payload.hunger.toFixed(0)} | Thirst ${payload.thirst.toFixed(0)} | Energy ${payload.energy.toFixed(0)} | Health ${payload.health.toFixed(0)} | Cleanliness ${payload.cleanliness.toFixed(0)} | Mood ${payload.mood.toFixed(0)}`
      );
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
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:feed');
    });

    this.cleanButton = this.createActionButton('CLEAN', 0x365f82, () => {
      this.sound.play('ui-click', { volume: 0.25 });
      this.scene.get('CageScene').events.emit('action:clean');
    });

    this.debugButton = this.createActionButton('DEBUG', 0x5e4168, () => {
      this.sound.play('ui-click', { volume: 0.22 });
      this.toggleDebugPanel();
    });
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
    const horizontalPadding = 14;
    const controlsBottomOffset = 28;
    const buttonGap = 12;

    if (this.feedButton) {
      this.feedButton.setPosition(width - horizontalPadding - 68 - 136 - 136 - buttonGap * 2, height - controlsBottomOffset);
    }

    if (this.cleanButton) {
      this.cleanButton.setPosition(width - horizontalPadding - 68 - 136 - buttonGap, height - controlsBottomOffset);
    }

    if (this.debugButton) {
      this.debugButton.setPosition(width - horizontalPadding - 68, height - controlsBottomOffset);
    }

    if (this.debugHintText) {
      this.debugHintText.setPosition(width - 15, 10);
    }

    if (this.debugStatusText) {
      this.debugStatusText.setPosition(16, 28);
    }

    this.dialogBackdrop?.setPosition(width / 2, height / 2).setSize(width, height);
    this.dialogPanel?.setPosition(width / 2, height / 2).setSize(Math.min(560, width - 28), Math.min(330, height - 70));
  }
}
