import Phaser from 'phaser';
import { type CageInteractiveProp, type PropEffectName } from './Prop';

export class FoodBowlProp implements CageInteractiveProp {
  public readonly id: string;
  public readonly container: Phaser.GameObjects.Container;
  public readonly sprite: Phaser.GameObjects.Container;
  public readonly interactiveArea: Phaser.Geom.Rectangle;

  private readonly scene: Phaser.Scene;
  private readonly bowl: Phaser.GameObjects.Ellipse;
  private readonly kibble: Phaser.GameObjects.Arc[];

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, width: number, height: number, color: number) {
    this.scene = scene;
    this.id = id;
    this.container = scene.add.container(x, y);
    this.bowl = scene.add.ellipse(0, 0, width, height * 0.5, color, 0.16).setStrokeStyle(2, color, 0.9);
    this.kibble = [
      scene.add.circle(-width * 0.18, -height * 0.12, 3, color, 0.45),
      scene.add.circle(0, -height * 0.14, 3, color, 0.45),
      scene.add.circle(width * 0.17, -height * 0.1, 3, color, 0.45),
    ];

    this.container.add([this.bowl, ...this.kibble]);
    this.container.setSize(width, height);
    this.sprite = this.container;
    this.interactiveArea = new Phaser.Geom.Rectangle(-width * 0.5, -height * 0.5, width, height);
  }

  public setActive(active: boolean): void {
    this.container.setAlpha(active ? 1 : 0.8);
  }

  public playEffect(name: PropEffectName): void {
    if (name === 'activate') {
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.04,
        scaleY: 0.96,
        duration: 140,
        yoyo: true,
      });

      this.kibble.forEach((piece) => {
        this.scene.tweens.add({
          targets: piece,
          y: piece.y - 8,
          alpha: 0.4,
          duration: 240,
          yoyo: true,
          delay: Phaser.Math.Between(0, 100),
        });
      });
      return;
    }

    if (name === 'cooldown') {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0.4,
        duration: 150,
        yoyo: true,
      });
    }
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}
