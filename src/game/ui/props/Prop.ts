import Phaser from 'phaser';

export type PropEffectName = 'activate' | 'deactivate' | 'cooldown' | 'idle' | 'traverse';

export interface CageInteractiveProp {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.GameObject;
  readonly container?: Phaser.GameObjects.Container;
  readonly interactiveArea: Phaser.Geom.Rectangle;
  setActive(active: boolean): void;
  playEffect(name: PropEffectName): void;
  destroy(): void;
}
