import Phaser from 'phaser';
import { HamsterActor } from './HamsterActor';

export type CagePropKind = 'wheel' | 'food-bowl' | 'water-bottle' | 'tunnel' | 'hideout' | 'custom';

export interface CagePropDefinition {
  id: string;
  kind: CagePropKind;
  x: number;
  y: number;
  width?: number;
  height?: number;
  depth?: 'back' | 'front';
  color?: number;
}

export interface CagePropState {
  alpha?: number;
  visible?: boolean;
  tint?: number;
  x?: number;
  y?: number;
  scale?: number;
}

export class CageView {
  public readonly root: Phaser.GameObjects.Container;
  public readonly backgroundLayer: Phaser.GameObjects.Container;
  public readonly propLayer: Phaser.GameObjects.Container;
  public readonly actorLayer: Phaser.GameObjects.Container;
  public readonly foregroundLayer: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly floor: Phaser.GameObjects.Rectangle;
  private readonly foregroundBars: Phaser.GameObjects.Graphics;
  private readonly props = new Map<string, Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.root = scene.add.container(0, 0).setDepth(0);
    this.backgroundLayer = scene.add.container(0, 0);
    this.propLayer = scene.add.container(0, 0);
    this.actorLayer = scene.add.container(0, 0);
    this.foregroundLayer = scene.add.container(0, 0);

    this.background = scene.add.rectangle(0, 0, 1, 1, 0x1d2535).setOrigin(0, 0);
    this.floor = scene.add.rectangle(0, 0, 1, 1, 0xc7b58b).setOrigin(0, 0);
    this.foregroundBars = scene.add.graphics();

    this.backgroundLayer.add([this.background, this.floor]);
    this.foregroundLayer.add(this.foregroundBars);

    this.root.add([
      this.backgroundLayer,
      this.propLayer,
      this.actorLayer,
      this.foregroundLayer,
    ]);
  }

  public addProp(definition: CagePropDefinition): Phaser.GameObjects.GameObject {
    const existing = this.props.get(definition.id);
    existing?.destroy();

    const object = this.createPropObject(definition);
    const targetLayer = definition.depth === 'front' ? this.foregroundLayer : this.propLayer;
    targetLayer.add(object);
    this.props.set(definition.id, object);
    return object;
  }

  public getProp(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.props.get(id);
  }

  public setPropState(id: string, state: CagePropState): void {
    const prop = this.props.get(id);
    if (!prop) {
      return;
    }

    if (typeof state.visible === 'boolean' && 'setVisible' in prop) {
      (prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(state.visible);
    }

    if (typeof state.alpha === 'number' && 'setAlpha' in prop) {
      (prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha).setAlpha(state.alpha);
    }

    if (typeof state.tint === 'number' && 'setTint' in prop) {
      (prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Tint).setTint(state.tint);
    }

    if ((typeof state.x === 'number' || typeof state.y === 'number') && 'setPosition' in prop) {
      const current = prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
      current.setPosition(state.x ?? current.x, state.y ?? current.y);
    }

    if (typeof state.scale === 'number' && 'setScale' in prop) {
      (prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform).setScale(state.scale);
    }
  }

  public attachHamster(actor: HamsterActor): void {
    this.actorLayer.add(actor.root);
  }

  public layout(width: number, height: number): void {
    const floorHeight = Math.max(100, Math.floor(height * 0.28));

    this.background.setSize(width, height).setPosition(0, 0);
    this.floor.setSize(width, floorHeight).setPosition(0, height - floorHeight);

    this.foregroundBars.clear();
    this.foregroundBars.lineStyle(4, 0xadb2bf, 0.85);

    const spacing = 56;
    for (let x = spacing; x < width; x += spacing) {
      this.foregroundBars.lineBetween(x, 0, x, height);
    }
  }

  public destroy(): void {
    this.props.clear();
    this.root.destroy(true);
  }

  private createPropObject(definition: CagePropDefinition): Phaser.GameObjects.GameObject {
    const width = definition.width ?? 96;
    const height = definition.height ?? 72;
    const color = definition.color ?? 0x808080;

    switch (definition.kind) {
      case 'wheel': {
        const wheel = this.scene.add.ellipse(definition.x, definition.y, width, width, color, 1).setStrokeStyle(6, 0x3a3a3a);
        return wheel;
      }
      case 'food-bowl': {
        return this.scene.add.ellipse(definition.x, definition.y, width, height * 0.5, color, 1).setStrokeStyle(3, 0x553311);
      }
      case 'water-bottle': {
        return this.scene.add.rectangle(definition.x, definition.y, width * 0.28, height, color, 1).setStrokeStyle(2, 0xffffff);
      }
      case 'tunnel': {
        const tunnel = this.scene.add.rectangle(definition.x, definition.y, width, height, color, 1).setStrokeStyle(4, 0x5e3f22);
        return tunnel;
      }
      case 'hideout': {
        return this.scene.add.rectangle(definition.x, definition.y, width, height, color, 1).setStrokeStyle(4, 0x2d1e12);
      }
      case 'custom':
      default:
        return this.scene.add.rectangle(definition.x, definition.y, width, height, color, 1);
    }
  }
}
