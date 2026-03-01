import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1020');

    const title = this.add
      .text(320, 220, 'New 2D Game Prototype', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(320, 260, 'Start building your new gameplay loop here.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8ba3ff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [title, hint],
      alpha: { from: 0.75, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
