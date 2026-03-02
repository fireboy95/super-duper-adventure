import Phaser from 'phaser';
import { type CageInteractiveProp, type PropEffectName } from './Prop';

export class WaterBottleProp implements CageInteractiveProp {
  public readonly id: string;
  public readonly container: Phaser.GameObjects.Container;
  public readonly sprite: Phaser.GameObjects.Container;
  public readonly interactiveArea: Phaser.Geom.Rectangle;

  private readonly scene: Phaser.Scene;
  private readonly drip: Phaser.GameObjects.Arc;
  private dripTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, width: number, height: number, color: number) {
    this.scene = scene;
    this.id = id;

    const bottleBody = scene.add.rectangle(0, 0, width * 0.28, height, color, 1).setStrokeStyle(2, 0xffffff);
    const nozzle = scene.add.rectangle(0, height * 0.46, width * 0.2, height * 0.16, 0xb4b8c8, 1).setOrigin(0.5, 0);
    this.drip = scene.add.circle(0, height * 0.72, 3, 0x89d2ff, 0);

    this.container = scene.add.container(x, y, [bottleBody, nozzle, this.drip]);
    this.container.setSize(width, height);
    this.sprite = this.container;
    this.interactiveArea = new Phaser.Geom.Rectangle(-width * 0.5, -height * 0.5, width, height);
  }

  public setActive(active: boolean): void {
    if (active) {
      this.startDripLoop();
      return;
    }

    this.dripTween?.stop();
    this.dripTween = undefined;
    this.drip.setAlpha(0);
    this.drip.setY(this.container.height * 0.72);
  }

  public playEffect(name: PropEffectName): void {
    if (name === 'activate') {
      this.startDripLoop();
      return;
    }

    if (name === 'cooldown') {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0.7,
        duration: 120,
        yoyo: true,
      });
    }
  }

  public destroy(): void {
    this.setActive(false);
    this.container.destroy(true);
  }

  private startDripLoop(): void {
    if (this.dripTween) {
      return;
    }

    this.dripTween = this.scene.tweens.add({
      targets: this.drip,
      y: this.container.height,
      alpha: { from: 0.9, to: 0 },
      duration: 520,
      ease: 'Quad.easeIn',
      repeat: -1,
      repeatDelay: 260,
      onRepeat: () => {
        this.drip.setY(this.container.height * 0.72);
      },
    });
  }
}
