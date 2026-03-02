import Phaser from 'phaser';
import { HamsterActor } from './HamsterActor';
import { FoodBowlProp } from './props/FoodBowlProp';
import { type CageInteractiveProp } from './props/Prop';
import { TunnelProp } from './props/TunnelProp';
import { WaterBottleProp } from './props/WaterBottleProp';
import { WheelProp } from './props/WheelProp';

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

interface CagePropRegistration {
  object: Phaser.GameObjects.GameObject;
  interactive?: CageInteractiveProp;
}

export class CageView {
  public readonly root: Phaser.GameObjects.Container;
  public readonly backgroundLayer: Phaser.GameObjects.Container;
  public readonly propLayer: Phaser.GameObjects.Container;
  public readonly actorLayer: Phaser.GameObjects.Container;
  public readonly foregroundLayer: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly events = new Phaser.Events.EventEmitter();
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly floor: Phaser.GameObjects.Rectangle;
  private readonly foregroundBars: Phaser.GameObjects.Graphics;
  private readonly props = new Map<string, CagePropRegistration>();
  private readonly cooldownUntil = new Map<string, number>();
  private hamster?: HamsterActor;

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
    if (existing) {
      existing.interactive?.destroy();
      existing.object.destroy();
    }

    const created = this.createPropObject(definition);
    const targetLayer = definition.depth === 'front' ? this.foregroundLayer : this.propLayer;
    targetLayer.add(created.object);
    this.props.set(definition.id, created);
    if (created.interactive) {
      this.configureInteractivity(created.interactive);
    }

    return created.object;
  }

  public on(event: 'prop:activated' | 'prop:cooldown', listener: (payload: { id: string; kind: CagePropKind }) => void): void {
    this.events.on(event, listener);
  }

  public off(event: 'prop:activated' | 'prop:cooldown', listener: (payload: { id: string; kind: CagePropKind }) => void): void {
    this.events.off(event, listener);
  }

  public getProp(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.props.get(id)?.object;
  }

  public setPropState(id: string, state: CagePropState): void {
    const prop = this.props.get(id)?.object;
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
    this.hamster = actor;
    this.actorLayer.add(actor.root);

    for (const registration of this.props.values()) {
      if (registration.interactive instanceof TunnelProp) {
        registration.interactive.attachActor(actor);
      }
    }
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
    this.cooldownUntil.clear();
    this.events.removeAllListeners();
    for (const registration of this.props.values()) {
      registration.interactive?.destroy();
    }
    this.props.clear();
    this.root.destroy(true);
  }

  private createPropObject(definition: CagePropDefinition): CagePropRegistration {
    const width = definition.width ?? 96;
    const height = definition.height ?? 72;
    const color = definition.color ?? 0x808080;

    switch (definition.kind) {
      case 'wheel': {
        const interactive = new WheelProp(this.scene, definition.id, definition.x, definition.y, width, color);
        return { object: interactive.sprite, interactive };
      }
      case 'food-bowl': {
        const interactive = new FoodBowlProp(this.scene, definition.id, definition.x, definition.y, width, height, color);
        return { object: interactive.sprite, interactive };
      }
      case 'water-bottle': {
        const interactive = new WaterBottleProp(this.scene, definition.id, definition.x, definition.y, width, height, color);
        return { object: interactive.sprite, interactive };
      }
      case 'tunnel': {
        const interactive = new TunnelProp(this.scene, definition.id, definition.x, definition.y, width, height, color);
        if (this.hamster) {
          interactive.attachActor(this.hamster);
        }
        return { object: interactive.sprite, interactive };
      }
      case 'hideout': {
        return { object: this.scene.add.rectangle(definition.x, definition.y, width, height, color, 1).setStrokeStyle(4, 0x2d1e12) };
      }
      case 'custom':
      default:
        return { object: this.scene.add.rectangle(definition.x, definition.y, width, height, color, 1) };
    }
  }

  private configureInteractivity(prop: CageInteractiveProp): void {
    const object = prop.sprite as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
    if (!('setInteractive' in object)) {
      return;
    }

    (object as Phaser.GameObjects.Zone | Phaser.GameObjects.Shape | Phaser.GameObjects.Container).setInteractive(
      prop.interactiveArea,
      Phaser.Geom.Rectangle.Contains,
    );

    object.on(Phaser.Input.Events.POINTER_DOWN, () => {
      const now = this.scene.time.now;
      const cooldownEnd = this.cooldownUntil.get(prop.id) ?? 0;

      if (now < cooldownEnd) {
        prop.playEffect('cooldown');
        this.events.emit('prop:cooldown', { id: prop.id, kind: this.kindFromId(prop.id) });
        return;
      }

      prop.setActive(true);
      prop.playEffect(prop.id === 'tunnel' ? 'traverse' : 'activate');
      this.events.emit('prop:activated', { id: prop.id, kind: this.kindFromId(prop.id) });
      this.cooldownUntil.set(prop.id, now + 1800);
      this.scene.time.delayedCall(1200, () => prop.setActive(false));
    });
  }

  private kindFromId(id: string): CagePropKind {
    switch (id) {
      case 'wheel':
      case 'food-bowl':
      case 'water-bottle':
      case 'tunnel':
        return id;
      default:
        return 'custom';
    }
  }
}
