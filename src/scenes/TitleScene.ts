import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
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

    const start = this.add
      .text(320, 260, '[ START ]', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#00ff99',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    start.on('pointerdown', () => {
      this.scene.start('CageScene');
      this.scene.launch('UIScene');
    });
  }
}
