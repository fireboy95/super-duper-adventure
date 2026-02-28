import Phaser from 'phaser';
import { DialogueSystem } from '../systems/DialogueSystem';

export class UIScene extends Phaser.Scene {
  private dialogueSystem = new DialogueSystem();
  private dialogText?: Phaser.GameObjects.Text;

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

    this.dialogText = this.add.text(20, 420, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f6f6f6',
      wordWrap: { width: 600 },
    });

    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('dialog:show', (dialogId: string) => {
      const dialog = this.dialogueSystem.getById(dialogId);
      if (!dialog || !this.dialogText) return;
      this.dialogText.setText(`${dialog.title} (${dialog.speaker}): ${dialog.pages[0]}`);
    });
  }
}
