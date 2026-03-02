import Phaser from 'phaser';
import { HamsterActor } from '../HamsterActor';
import { type CageInteractiveProp, type PropEffectName } from './Prop';

export class TunnelProp implements CageInteractiveProp {
  public readonly id: string;
  public readonly container: Phaser.GameObjects.Container;
  public readonly sprite: Phaser.GameObjects.Container;
  public readonly interactiveArea: Phaser.Geom.Rectangle;

  private readonly scene: Phaser.Scene;
  private readonly entryMarker: Phaser.GameObjects.Triangle;
  private readonly exitMarker: Phaser.GameObjects.Triangle;
  private actor?: HamsterActor;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, width: number, height: number, color: number) {
    this.scene = scene;
    this.id = id;

    const tunnelBody = scene.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(4, 0x5e3f22);
    this.entryMarker = scene.add.triangle(-width * 0.35, -height * 0.52, 0, 12, 18, 0, 36, 12, 0x9be37c, 0.9);
    this.exitMarker = scene.add.triangle(width * 0.35, -height * 0.52, 0, 12, 18, 0, 36, 12, 0x9be37c, 0.45);

    this.container = scene.add.container(x, y, [tunnelBody, this.entryMarker, this.exitMarker]);
    this.container.setSize(width, height);
    this.sprite = this.container;
    this.interactiveArea = new Phaser.Geom.Rectangle(-width * 0.5, -height * 0.5, width, height);
  }

  public attachActor(actor: HamsterActor): void {
    this.actor = actor;
  }

  public setActive(active: boolean): void {
    this.entryMarker.setAlpha(active ? 1 : 0.65);
    this.exitMarker.setAlpha(active ? 1 : 0.45);
  }

  public playEffect(name: PropEffectName): void {
    if (name === 'activate' || name === 'traverse') {
      this.scene.tweens.add({
        targets: [this.entryMarker, this.exitMarker],
        alpha: 1,
        duration: 120,
        yoyo: true,
        repeat: 2,
      });

      if (!this.actor) {
        return;
      }

      this.actor.root.setVisible(false);
      this.scene.time.delayedCall(650, () => {
        this.actor?.root.setVisible(true);
      });
      return;
    }

    if (name === 'cooldown') {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0.6,
        duration: 160,
        yoyo: true,
      });
    }
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}
