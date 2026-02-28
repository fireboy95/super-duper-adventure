import Phaser from 'phaser';
import { DialogueSystem } from '../systems/DialogueSystem';
import { DebugConsoleEntry, debugConsole } from '../systems/DebugConsole';

export class UIScene extends Phaser.Scene {
  private dialogueSystem = new DialogueSystem();
  private dialogText?: Phaser.GameObjects.Text;
  private debugPanel?: Phaser.GameObjects.Container;
  private debugText?: Phaser.GameObjects.Text;
  private debugHintText?: Phaser.GameObjects.Text;
  private isDebugOpen = false;
  private unsubscribeDebug?: () => void;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.add.rectangle(320, 22, 640, 44, 0x1f1f1f, 0.9);
    this.add.text(16, 10, 'HUD: Hunger / Mood / Cleanliness', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f7f7f7',
    });

    this.debugHintText = this.add.text(625, 10, '[` DEBUG]', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff99',
    });
    this.debugHintText.setOrigin(1, 0);

    this.dialogText = this.add.text(20, 420, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f6f6f6',
      wordWrap: { width: 600 },
    });

    this.createDebugOverlay();
    this.bindDebugToggle();
    this.bindDialogueEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeDebug?.();
    });
  }

  private bindDialogueEvents(): void {
    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('dialog:show', (dialogId: string) => {
      const dialog = this.dialogueSystem.getById(dialogId);
      if (!dialog || !this.dialogText) return;
      this.dialogText.setText(`${dialog.title} (${dialog.speaker}): ${dialog.pages[0]}`);
      console.info('[dialog]', dialog.id, dialog.title);
    });
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
      this.isDebugOpen = !this.isDebugOpen;
      this.debugPanel?.setVisible(this.isDebugOpen);
      this.debugHintText?.setColor(this.isDebugOpen ? '#ffffff' : '#00ff99');
      console.log(`[debug] Console ${this.isDebugOpen ? 'opened' : 'closed'}`);
    });
  }

  private renderDebugEntries(entries: DebugConsoleEntry[]): void {
    if (!this.debugText) return;
    const lines = entries
      .slice(-8)
      .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`);

    this.debugText.setText(lines.join('\n'));
  }
}
