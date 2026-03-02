import Phaser from 'phaser';
import { type CageInteractiveProp, type PropEffectName } from './Prop';

export class WheelProp implements CageInteractiveProp {
  public readonly id: string;
  public readonly sprite: Phaser.GameObjects.Arc;
  public readonly interactiveArea: Phaser.Geom.Rectangle;

  private readonly scene: Phaser.Scene;
  private readonly axle: Phaser.GameObjects.Arc;
  private spinTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, size: number, color: number) {
    this.scene = scene;
    this.id = id;
    this.sprite = scene.add.circle(x, y, size * 0.5, color, 0.14).setStrokeStyle(3, color, 0.9);
    this.axle = scene.add.circle(x, y, size * 0.08, color, 0.8);
    this.sprite.setDataEnabled();
    this.sprite.data?.set('wheelAxle', this.axle);
    this.interactiveArea = new Phaser.Geom.Rectangle(-size * 0.5, -size * 0.5, size, size);
  }

  public setActive(active: boolean): void {
    if (active) {
      if (this.spinTween) {
        return;
      }

      this.spinTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: this.sprite.angle + 360,
        duration: 700,
        ease: 'Linear',
        repeat: -1,
      });
      return;
    }

    this.spinTween?.stop();
    this.spinTween = undefined;
  }

  public playEffect(name: PropEffectName): void {
    if (name === 'activate') {
      this.setActive(true);
      return;
    }

    if (name === 'cooldown' || name === 'deactivate') {
      this.setActive(false);
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.45,
        yoyo: true,
        duration: 180,
      });
    }
  }

  public destroy(): void {
    this.setActive(false);
    this.axle.destroy();
    this.sprite.destroy();
  }
}
