import Phaser from 'phaser';

const PLAYER_SPEED = 190;

export class GameScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private player?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#22334a');

    this.add.text(320, 36, '2D GAME STARTER', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f8f8f8',
    }).setOrigin(0.5);

    this.add.text(320, 64, 'Move with arrow keys', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d1e1ff',
    }).setOrigin(0.5);

    this.add.rectangle(320, 260, 500, 320, 0x1a2533, 1).setStrokeStyle(2, 0x4f7fb8);

    this.player = this.add.rectangle(320, 260, 22, 22, 0xf5a623);
    this.cursors = this.input.keyboard?.createCursorKeys();
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) {
      return;
    }

    const dt = delta / 1000;
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown) velocityX = -1;
    if (this.cursors.right.isDown) velocityX = 1;
    if (this.cursors.up.isDown) velocityY = -1;
    if (this.cursors.down.isDown) velocityY = 1;

    if (velocityX !== 0 && velocityY !== 0) {
      const normalized = Math.SQRT1_2;
      velocityX *= normalized;
      velocityY *= normalized;
    }

    this.player.x = Phaser.Math.Clamp(this.player.x + velocityX * PLAYER_SPEED * dt, 81, 559);
    this.player.y = Phaser.Math.Clamp(this.player.y + velocityY * PLAYER_SPEED * dt, 101, 419);
  }
}
