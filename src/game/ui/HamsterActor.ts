import Phaser from 'phaser';
import { type HamsterMood } from './hamsterMoodMap';

const HAMSTER_STATES = ['idle', 'run', 'sleep', 'eat', 'wheel', 'groom'] as const;

const MOOD_COLOR_MAP: Record<HamsterMood, number> = {
  calm: 0xf4d7a6,
  excited: 0xffc86a,
  sleepy: 0xb6c3ef,
  curious: 0x9af0dc,
  angry: 0xff7a70,
};

type HamsterState = (typeof HAMSTER_STATES)[number];
type FacingDirection = 'left' | 'right';

export class HamsterActor {
  public readonly root: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly moodAura: Phaser.GameObjects.Arc;
  private readonly moodSpark: Phaser.GameObjects.Arc;
  private readonly propBadge: Phaser.GameObjects.Text;
  private currentState?: HamsterState;
  private currentMood: HamsterMood = 'calm';
  private currentFacing: FacingDirection = 'right';
  private moveTween?: Phaser.Tweens.Tween;
  private moodTween?: Phaser.Tweens.Tween;
  private sparkTween?: Phaser.Tweens.Tween;
  private propBadgeTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, scale = 1) {
    this.scene = scene;

    this.ensureFallbackTexture(textureKey);
    this.ensureAnimations(textureKey);

    this.root = scene.add.container(x, y).setDepth(1);
    this.moodAura = scene.add.circle(0, 2, 30, MOOD_COLOR_MAP.calm, 0.14).setVisible(false);
    this.moodSpark = scene.add.circle(0, -26, 4, MOOD_COLOR_MAP.calm, 0.9).setVisible(false);
    this.sprite = scene.add.sprite(0, 0, textureKey).setScale(scale);
    this.propBadge = scene.add
      .text(0, -35, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#fdf9f2',
        backgroundColor: 'rgba(28,34,52,0.72)',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.root.add([this.moodAura, this.sprite, this.moodSpark, this.propBadge]);
    this.root.setSize(this.sprite.displayWidth, this.sprite.displayHeight);

    this.setState('idle');
    this.applyMoodVisuals();
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
    this.moodAura.setScale(scale);
  }

  public setState(nextState: HamsterState): void {
    if (this.currentState === nextState) {
      return;
    }

    this.currentState = nextState;
    this.sprite.play(`hamster-${nextState}`, true);
    this.applyMoodAnimationBias();
  }

  public setMood(mood: HamsterMood): void {
    if (this.currentMood === mood) {
      return;
    }

    this.currentMood = mood;
    this.applyMoodAnimationBias();
    this.applyMoodVisuals();
  }

  public showPropInteraction(label: string): void {
    this.propBadgeTween?.stop();
    this.propBadge.setText(label).setAlpha(1).setScale(1).setVisible(true);
    this.propBadgeTween = this.scene.tweens.add({
      targets: this.propBadge,
      y: -44,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.propBadge.setVisible(false).setY(-35);
      },
    });
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
    this.sparkTween?.stop();
    this.propBadgeTween?.stop();
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
      case 'groom':
        return 6;
      case 'idle':
      default:
        return 5;
    }
  }

  private applyMoodAnimationBias(): void {
    const state = this.currentState ?? 'idle';
    this.sprite.anims.timeScale = this.animationTimeScaleForMood(state);
  }

  private animationTimeScaleForMood(state: HamsterState): number {
    switch (this.currentMood) {
      case 'excited':
        return state === 'sleep' ? 0.95 : 1.25;
      case 'sleepy':
        return state === 'sleep' ? 1 : 0.78;
      case 'curious':
        return state === 'run' || state === 'wheel' ? 1.1 : 1.02;
      case 'angry':
        return state === 'sleep' ? 0.6 : 1.4;
      case 'calm':
      default:
        return state === 'sleep' ? 1.1 : 0.9;
    }
  }

  private applyMoodVisuals(): void {
    const tint = MOOD_COLOR_MAP[this.currentMood];
    this.sprite.setTint(tint);
    this.moodAura.setFillStyle(tint, this.currentMood === 'calm' ? 0.1 : 0.2);
    this.moodSpark.setFillStyle(tint, 0.9);

    this.moodTween?.stop();
    this.sparkTween?.stop();

    if (this.currentMood === 'calm') {
      this.moodAura.setVisible(false).setScale(1).setAlpha(0.12);
      this.moodSpark.setVisible(false);
      this.root.setAngle(0);
      return;
    }

    this.moodAura.setVisible(true).setScale(0.95).setAlpha(0.16);
    this.moodTween = this.scene.tweens.add({
      targets: this.moodAura,
      scale: this.currentMood === 'angry' ? 1.18 : 1.08,
      alpha: this.currentMood === 'angry' ? 0.3 : 0.24,
      yoyo: true,
      repeat: -1,
      duration: this.currentMood === 'sleepy' ? 1300 : 700,
      ease: 'Sine.easeInOut',
    });

    this.moodSpark.setVisible(this.currentMood !== 'sleepy').setAlpha(0.9).setY(-26);
    if (this.currentMood !== 'sleepy') {
      this.sparkTween = this.scene.tweens.add({
        targets: this.moodSpark,
        y: -36,
        alpha: 0,
        duration: this.currentMood === 'angry' ? 280 : 520,
        ease: 'Quad.easeOut',
        repeat: -1,
      });
    }

    if (this.currentMood === 'angry') {
      this.scene.tweens.add({
        targets: this.root,
        angle: { from: -2, to: 2 },
        duration: 80,
        yoyo: true,
        repeat: 5,
      });
    }
  }
}
