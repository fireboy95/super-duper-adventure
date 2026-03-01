import Phaser from 'phaser';
import { AudioSystem } from '../game/systems/AudioSystem';

export class MainScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private audioSystem?: AudioSystem;
  private moveSoundCooldownMs = 0;

  constructor() {
    super('main-scene');
  }

  preload(): void {
    this.load.audio('move-blip', 'assets/audio/move-blip.wav');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1e1e2f');
    const hasKeyboardInput = Boolean(this.input.keyboard?.enabled);
    const movementInstruction = hasKeyboardInput
      ? 'Use arrow keys to move the player.'
      : 'Drag or use on-screen controls to move.';
    const audioInstruction = hasKeyboardInput
      ? 'Movement plays blip audio while holding arrow keys.'
      : 'Movement plays blip audio while moving.';

    this.add
      .text(16, 16, 'Phaser Starter', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setDepth(1);

    this.add
      .text(16, 52, movementInstruction, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9ad1ff',
      })
      .setDepth(1);

    this.add
      .text(16, 74, audioInstruction, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffd166',
      })
      .setDepth(1);

    this.player = this.add.circle(400, 300, 20, 0x4caf50);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.audioSystem = new AudioSystem(this);
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) return;

    const speed = 0.25 * delta;

    const isMoving =
      this.cursors.left.isDown ||
      this.cursors.right.isDown ||
      this.cursors.up.isDown ||
      this.cursors.down.isDown;

    if (this.cursors.left.isDown) this.player.x -= speed;
    if (this.cursors.right.isDown) this.player.x += speed;
    if (this.cursors.up.isDown) this.player.y -= speed;
    if (this.cursors.down.isDown) this.player.y += speed;

    this.moveSoundCooldownMs = Math.max(0, this.moveSoundCooldownMs - delta);
    if (isMoving && this.moveSoundCooldownMs === 0) {
      this.audioSystem?.playSfx('move-blip', {
        config: { volume: 0.3 },
        warnOnMissing: true,
      });
      this.moveSoundCooldownMs = 120;
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 20, this.scale.width - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y, 20, this.scale.height - 20);
  }
}
