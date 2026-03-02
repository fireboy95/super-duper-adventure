import Phaser from 'phaser';

const HAMSTER_STATES = ['idle', 'run', 'sleep', 'eat', 'wheel'] as const;

type HamsterState = (typeof HAMSTER_STATES)[number];
type FacingDirection = 'left' | 'right';
type HamsterMood = 'neutral' | 'happy' | 'sleepy' | 'angry' | 'curious';

export class HamsterActor {
  public readonly root: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly moodAura: Phaser.GameObjects.Ellipse;
  private readonly moodIcon: Phaser.GameObjects.Text;
  private currentState?: HamsterState;
  private currentMood: HamsterMood = 'neutral';
  private currentFacing: FacingDirection = 'right';
  private moveTween?: Phaser.Tweens.Tween;
  private moodTween?: Phaser.Tweens.Tween;
  private moodResetTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, scale = 1) {
    this.scene = scene;

    this.ensureFallbackTexture(textureKey);
    this.ensureAnimations(textureKey);

    this.root = scene.add.container(x, y).setDepth(1);
    this.moodAura = scene.add.ellipse(0, 14, 62, 20, 0xffffff, 0.18).setVisible(false);
    this.sprite = scene.add.sprite(0, 0, textureKey).setScale(scale);
    this.moodIcon = scene.add.text(0, -32, '', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5).setVisible(false);
    this.root.add([this.moodAura, this.sprite, this.moodIcon]);
    this.root.setSize(this.sprite.displayWidth, this.sprite.displayHeight);

    this.setState('idle');
  }

  public get x(): number {
    return this.root.x;
  }

  public setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  public setScale(scale: number): void {
    this.sprite.setScale(scale);
    this.root.setSize(this.sprite.displayWidth, this.sprite.displayHeight);
  }

  public setState(nextState: HamsterState): void {
    if (this.currentState === nextState) {
      return;
    }

    this.currentState = nextState;
    this.sprite.play(`hamster-${nextState}`, true);
    this.applyStateMotion(nextState);
  }

  public expressMood(mood: HamsterMood, durationMs = 0): void {
    this.currentMood = mood;
    this.applyMoodStyle(mood);

    this.moodResetTimer?.remove(false);
    this.moodResetTimer = undefined;
    if (durationMs > 0) {
      this.moodResetTimer = this.scene.time.delayedCall(durationMs, () => {
        this.currentMood = 'neutral';
        this.applyMoodStyle('neutral');
      });
    }
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
    this.moodTween?.stop();
    this.moodResetTimer?.remove(false);
    this.moveTween = undefined;
    this.root.destroy(true);
  }

  private applyStateMotion(state: HamsterState): void {
    this.moodTween?.stop();
    this.sprite.setScale(Math.abs(this.sprite.scaleX), this.sprite.scaleY);

    if (state === 'run' || state === 'wheel') {
      this.moodTween = this.scene.tweens.add({
        targets: this.sprite,
        y: { from: 0, to: -4 },
        duration: 130,
        yoyo: true,
        repeat: -1,
      });
      return;
    }

    if (state === 'sleep') {
      this.moodTween = this.scene.tweens.add({
        targets: this.sprite,
        scaleY: this.sprite.scaleY * 0.95,
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      return;
    }

    this.sprite.setY(0);
  }

  private applyMoodStyle(mood: HamsterMood): void {
    switch (mood) {
      case 'happy':
        this.sprite.setTint(0xfff6b0);
        this.moodAura.setFillStyle(0xffde7a, 0.32).setVisible(true);
        this.moodIcon.setText('✨').setVisible(true);
        break;
      case 'sleepy':
        this.sprite.setTint(0xb8d1ff);
        this.moodAura.setFillStyle(0xa7bcff, 0.28).setVisible(true);
        this.moodIcon.setText('💤').setVisible(true);
        break;
      case 'angry':
        this.sprite.setTint(0xff9d9d);
        this.moodAura.setFillStyle(0xff7a7a, 0.35).setVisible(true);
        this.moodIcon.setText('💢').setVisible(true);
        break;
      case 'curious':
        this.sprite.setTint(0xc8f0ff);
        this.moodAura.setFillStyle(0x95e5ff, 0.25).setVisible(true);
        this.moodIcon.setText('❔').setVisible(true);
        break;
      case 'neutral':
      default:
        this.sprite.clearTint();
        this.moodAura.setVisible(false);
        this.moodIcon.setVisible(false);
        break;
    }
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
