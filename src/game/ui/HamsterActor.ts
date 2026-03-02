import Phaser from 'phaser';

const HAMSTER_STATES = ['idle', 'run', 'sleep', 'eat', 'wheel'] as const;

type HamsterState = (typeof HAMSTER_STATES)[number];
type FacingDirection = 'left' | 'right';

export class HamsterActor {
  public readonly root: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private currentState?: HamsterState;
  private currentFacing: FacingDirection = 'right';
  private moveTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, scale = 1) {
    this.scene = scene;

    this.ensureFallbackTexture(textureKey);
    this.ensureAnimations(textureKey);

    this.root = scene.add.container(x, y).setDepth(1);
    this.sprite = scene.add.sprite(0, 0, textureKey).setScale(scale);
    this.root.add(this.sprite);
    this.root.setSize(this.sprite.displayWidth, this.sprite.displayHeight);

    this.setState('idle');
  }

  public get x(): number {
    return this.root.x;
  }

  public setState(nextState: HamsterState): void {
    if (this.currentState === nextState) {
      return;
    }

    this.currentState = nextState;
    this.sprite.play(`hamster-${nextState}`, true);
  }

  public face(direction: FacingDirection): void {
    if (this.currentFacing === direction) {
      return;
    }

    this.currentFacing = direction;
    this.sprite.setFlipX(direction === 'left');
  }

  public moveTo(x: number, durationMs: number): void {
    const delta = x - this.root.x;
    if (delta === 0 || durationMs <= 0) {
      this.setState('idle');
      return;
    }

    this.moveTween?.stop();
    this.face(delta < 0 ? 'left' : 'right');
    this.setState('run');

    this.moveTween = this.scene.tweens.add({
      targets: this.root,
      x,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.moveTween = undefined;
        if (this.currentState === 'run') {
          this.setState('idle');
        }
      },
    });
  }

  public destroy(): void {
    this.moveTween?.stop();
    this.moveTween = undefined;
    this.root.destroy(true);
  }

  private ensureFallbackTexture(textureKey: string): void {
    if (this.scene.textures.exists(textureKey)) {
      return;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xf6c572, 1);
    graphics.fillRoundedRect(0, 0, 48, 32, 10);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(34, 12, 4);
    graphics.fillStyle(0x35251a, 1);
    graphics.fillCircle(34, 12, 2);
    graphics.generateTexture(textureKey, 48, 32);
    graphics.destroy();
  }

  private ensureAnimations(textureKey: string): void {
    for (const state of HAMSTER_STATES) {
      const animationKey = `hamster-${state}`;
      if (this.scene.anims.exists(animationKey)) {
        continue;
      }

      this.scene.anims.create({
        key: animationKey,
        frames: [
          { key: textureKey },
          { key: textureKey },
          { key: textureKey },
        ],
        frameRate: this.frameRateForState(state),
        repeat: -1,
      });
    }
  }

  private frameRateForState(state: HamsterState): number {
    switch (state) {
      case 'run':
        return 12;
      case 'wheel':
        return 14;
      case 'eat':
        return 8;
      case 'sleep':
        return 3;
      case 'idle':
      default:
        return 5;
    }
  }
}
