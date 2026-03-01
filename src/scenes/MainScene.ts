import Phaser from 'phaser';
import { AudioSystem } from '../game/systems/AudioSystem';

export class MainScene extends Phaser.Scene {
  private player?: Phaser.GameObjects.Arc;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private audioSystem?: AudioSystem;
  private moveSoundCooldownMs = 0;
  private moveX = 0;
  private moveY = 0;
  private keyboardMoveX = 0;
  private keyboardMoveY = 0;
  private pointerMoveX = 0;
  private pointerMoveY = 0;
  private activePointerId?: number;

  constructor() {
    super('main-scene');
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);

    this.input.keyboard?.on('keydown', this.handleKeyboardInteraction, this);
  }

  private shutdown(): void {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('pointerupoutside', this.handlePointerUp, this);
    this.input.keyboard?.off('keydown', this.handleKeyboardInteraction, this);
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;

    this.syncKeyboardMovement();
    this.syncUnifiedMovement();

    const speed = 0.25 * delta;

    const isMoving = this.moveX !== 0 || this.moveY !== 0;

    this.player.x += this.moveX * speed;
    this.player.y += this.moveY * speed;

    this.moveSoundCooldownMs = Math.max(0, this.moveSoundCooldownMs - delta);
    if (isMoving && this.moveSoundCooldownMs === 0) {
      this.audioSystem?.playMoveBlip(0.035);
      this.moveSoundCooldownMs = 120;
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 20, this.scale.width - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y, 20, this.scale.height - 20);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.audioSystem?.unlock();
    this.activePointerId = pointer.id;
    this.updatePointerMovement(pointer);
    this.syncUnifiedMovement();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== pointer.id) return;

    this.updatePointerMovement(pointer);
    this.syncUnifiedMovement();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== pointer.id) return;

    this.activePointerId = undefined;
    this.pointerMoveX = 0;
    this.pointerMoveY = 0;
    this.syncUnifiedMovement();
  }

  private updatePointerMovement(pointer: Phaser.Input.Pointer): void {
    if (!this.player) return;

    const deltaX = pointer.worldX - this.player.x;
    const deltaY = pointer.worldY - this.player.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 8) {
      this.pointerMoveX = 0;
      this.pointerMoveY = 0;
      return;
    }

    this.pointerMoveX = deltaX / distance;
    this.pointerMoveY = deltaY / distance;
  }

  private handleKeyboardInteraction(): void {
    this.audioSystem?.unlock();
  }

  private syncKeyboardMovement(): void {
    if (!this.cursors) {
      this.keyboardMoveX = 0;
      this.keyboardMoveY = 0;
      return;
    }

    this.keyboardMoveX = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    this.keyboardMoveY = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
  }

  private syncUnifiedMovement(): void {
    const combinedX = this.keyboardMoveX + this.pointerMoveX;
    const combinedY = this.keyboardMoveY + this.pointerMoveY;
    const magnitude = Math.hypot(combinedX, combinedY);

    if (magnitude > 0) {
      this.moveX = combinedX / magnitude;
      this.moveY = combinedY / magnitude;
      return;
    }

    this.moveX = 0;
    this.moveY = 0;
  }
}
