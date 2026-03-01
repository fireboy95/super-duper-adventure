import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1e1e2f');

    this.add
      .text(16, 16, 'Phaser Starter', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setDepth(1);

    this.add
      .text(16, 52, 'Use arrow keys to move the player.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9ad1ff',
      })
      .setDepth(1);

    this.player = this.add.circle(400, 300, 20, 0x4caf50);
    this.cursors = this.input.keyboard?.createCursorKeys();
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) return;

    const speed = 0.25 * delta;

    if (this.cursors.left.isDown) this.player.x -= speed;
    if (this.cursors.right.isDown) this.player.x += speed;
    if (this.cursors.up.isDown) this.player.y -= speed;
    if (this.cursors.down.isDown) this.player.y += speed;

    this.player.x = Phaser.Math.Clamp(this.player.x, 20, this.scale.width - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y, 20, this.scale.height - 20);
  }
}
