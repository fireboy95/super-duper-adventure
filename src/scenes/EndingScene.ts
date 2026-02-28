import Phaser from 'phaser';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('EndingScene');
  }

  create(data: { endingId?: string }): void {
    this.cameras.main.setBackgroundColor('#000000');
    const endingId = data.endingId ?? 'ending_unknown';

    this.add
      .text(320, 240, `Ending reached: ${endingId}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
