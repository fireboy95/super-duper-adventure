import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export class TitleScene extends Phaser.Scene {
  private saveSystem = new SaveSystem();

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1b3a');

    this.add
      .text(320, 160, "HAMSTER KEEPER '98", {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f0f0f0',
      })
      .setOrigin(0.5);

    const hasSave = this.saveSystem.hasSave();

    const continueEntry = this.add
      .text(320, 248, hasSave ? '[ CONTINUE ]' : '[ CONTINUE - NO SAVE ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hasSave ? '#00ff99' : '#666666',
      })
      .setOrigin(0.5);

    if (hasSave) {
      continueEntry.setInteractive({ useHandCursor: true });
      continueEntry.on('pointerdown', () => {
        this.scene.start('CageScene');
        this.scene.launch('UIScene');
      });
    }

    const newGame = this.add
      .text(320, 292, '[ NEW GAME ]', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f4cf6b',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGame.on('pointerdown', () => {
      this.saveSystem.clear();
      this.scene.start('CageScene', { forceNewGame: true });
      this.scene.launch('UIScene');
    });
  }
}
