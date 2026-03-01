import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class MainMenuScene extends Phaser.Scene {
  private saveSystem = new SaveSystem();

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1b3a');

    const { width, height } = this.scale;
    const centerX = width / 2;
    const titleY = Math.max(110, height * 0.28);

    this.add
      .text(centerX, titleY, "ARCADE ADVENTURE", {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f0f0f0',
      })
      .setOrigin(0.5);

    const hasSave = this.saveSystem.hasSave();

    const continueEntry = this.add
      .text(centerX, titleY + 88, hasSave ? '[ CONTINUE ]' : '[ CONTINUE - UNAVAILABLE ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hasSave ? '#00ff99' : '#666666',
      })
      .setOrigin(0.5);

    if (hasSave) {
      continueEntry.setInteractive({ useHandCursor: true });
      continueEntry.on('pointerdown', () => {
        this.scene.start('GameScene');
        this.scene.launch('HudScene');
      });
    }

    const newGame = this.add
      .text(centerX, titleY + 132, '[ NEW GAME ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f4cf6b',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGame.on('pointerdown', () => {
      this.saveSystem.clear();
      this.scene.start('GameScene');
      this.scene.launch('HudScene');
    });
  }
}
