import Phaser from 'phaser';
import { CageView } from '../ui/CageView';
import { HamsterActor } from '../ui/HamsterActor';

const BEHAVIOR_NAMES = ['wander', 'run-wheel', 'eat', 'drink', 'sleep', 'hide-in-tunnel'] as const;

export type HamsterBehaviorName = (typeof BEHAVIOR_NAMES)[number];

export type HamsterEmotion = 'neutral' | 'happy' | 'sleepy' | 'angry' | 'curious';

type BehaviorTrigger = 'tick' | 'external';

type BehaviorEventName = 'before-behavior' | 'after-behavior' | 'blocked-behavior';

export interface HamsterBehaviorEventPayload {
  behavior: HamsterBehaviorName;
  trigger: BehaviorTrigger;
  now: number;
  reason?: string;
}

interface BehaviorRule {
  weight: number;
  cooldownMs: number;
  run: () => void;
  guard?: () => string | undefined;
}

export interface HamsterBehaviorDirectorOptions {
  seed?: number;
  rng?: () => number;
}

class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export class HamsterBehaviorDirector {
  private readonly hamster: HamsterActor;
  private readonly cageView: CageView;
  private readonly random: () => number;
  private readonly events = new Phaser.Events.EventEmitter();
  private readonly cooldownsUntil = new Map<HamsterBehaviorName, number>();
  private readonly rules: Record<HamsterBehaviorName, BehaviorRule>;

  private lastBehavior?: HamsterBehaviorName;

  constructor(hamster: HamsterActor, cageView: CageView, options: HamsterBehaviorDirectorOptions = {}) {
    this.hamster = hamster;
    this.cageView = cageView;

    if (options.rng) {
      this.random = options.rng;
    } else {
      const seeded = new SeededRng(options.seed ?? Date.now());
      this.random = () => seeded.next();
    }

    this.rules = {
      wander: {
        weight: 4,
        cooldownMs: 900,
        run: () => this.runWander(),
      },
      'run-wheel': {
        weight: 3,
        cooldownMs: 3000,
        run: () => this.runWheel(),
      },
      eat: {
        weight: 2,
        cooldownMs: 3200,
        run: () => this.runEat(),
      },
      drink: {
        weight: 2,
        cooldownMs: 2800,
        run: () => this.runDrink(),
      },
      sleep: {
        weight: 1,
        cooldownMs: 6000,
        guard: () => (this.lastBehavior === 'run-wheel' ? 'cannot-sleep-after-wheel' : undefined),
        run: () => this.hamster.setState('sleep'),
      },
      'hide-in-tunnel': {
        weight: 2,
        cooldownMs: 4500,
        run: () => this.runHideInTunnel(),
      },
    };
  }

  public tick(now: number): void {
    const behavior = this.pickBehavior(now);
    if (!behavior) {
      return;
    }

    this.applyBehavior(behavior, now, 'tick');
  }

  public triggerBehavior(behavior: HamsterBehaviorName, now: number = Date.now()): boolean {
    const blockReason = this.getBlockReason(behavior, now);
    if (blockReason) {
      this.events.emit('blocked-behavior', { behavior, trigger: 'external', now, reason: blockReason } satisfies HamsterBehaviorEventPayload);
      return false;
    }

    this.applyBehavior(behavior, now, 'external');
    return true;
  }

  public on(event: BehaviorEventName, listener: (payload: HamsterBehaviorEventPayload) => void): void {
    this.events.on(event, listener);
  }

  public off(event: BehaviorEventName, listener: (payload: HamsterBehaviorEventPayload) => void): void {
    this.events.off(event, listener);
  }

  public dispose(): void {
    this.events.removeAllListeners();
    this.cooldownsUntil.clear();
    this.lastBehavior = undefined;
  }

  private pickBehavior(now: number): HamsterBehaviorName | undefined {
    const available = BEHAVIOR_NAMES
      .map((name) => ({ name, rule: this.rules[name] }))
      .filter(({ name }) => !this.getBlockReason(name, now));

    if (available.length === 0) {
      return undefined;
    }

    const totalWeight = available.reduce((sum, candidate) => sum + candidate.rule.weight, 0);
    let roll = this.random() * totalWeight;

    for (const candidate of available) {
      roll -= candidate.rule.weight;
      if (roll <= 0) {
        return candidate.name;
      }
    }

    return available[available.length - 1]?.name;
  }

  private getBlockReason(behavior: HamsterBehaviorName, now: number): string | undefined {
    const cooldownUntil = this.cooldownsUntil.get(behavior) ?? 0;
    if (cooldownUntil > now) {
      return 'cooldown';
    }

    return this.rules[behavior].guard?.();
  }

  private applyBehavior(behavior: HamsterBehaviorName, now: number, trigger: BehaviorTrigger): void {
    this.events.emit('before-behavior', { behavior, trigger, now } satisfies HamsterBehaviorEventPayload);
    this.hamster.expressMood(this.moodForBehavior(behavior), 1800);
    this.rules[behavior].run();
    this.lastBehavior = behavior;
    this.cooldownsUntil.set(behavior, now + this.rules[behavior].cooldownMs);
    this.events.emit('after-behavior', { behavior, trigger, now } satisfies HamsterBehaviorEventPayload);
  }

  private runWander(): void {
    const targetX = Phaser.Math.Clamp(this.hamster.x + Phaser.Math.Between(-150, 150), 64, this.hamster.root.scene.scale.width - 64);
    this.hamster.moveTo(targetX, Phaser.Math.Between(700, 1500));
  }

  private runWheel(): void {
    this.moveHamsterNearProp('wheel', () => this.hamster.setState('wheel'));
  }

  private runEat(): void {
    this.moveHamsterNearProp('food-bowl', () => this.hamster.setState('eat'));
  }

  private runDrink(): void {
    this.moveHamsterNearProp('water-bottle', () => this.hamster.setState('eat'));
  }

  private runHideInTunnel(): void {
    this.moveHamsterNearProp('tunnel', () => this.hamster.setState('idle'));
  }


  private moodForBehavior(behavior: HamsterBehaviorName): HamsterEmotion {
    switch (behavior) {
      case 'eat':
      case 'drink':
        return 'happy';
      case 'sleep':
        return 'sleepy';
      case 'hide-in-tunnel':
        return 'curious';
      case 'run-wheel':
        return 'angry';
      case 'wander':
      default:
        return 'neutral';
    }
  }

  private moveHamsterNearProp(propId: string, onArrive: () => void): void {
    const prop = this.cageView.getProp(propId);
    if (!prop || !('x' in prop)) {
      onArrive();
      return;
    }

    const propPosition = prop as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
    const moveDistance = Math.abs(this.hamster.x - propPosition.x);
    const duration = Phaser.Math.Clamp(moveDistance * 5, 400, 1400);
    this.hamster.moveTo(propPosition.x, duration);
    this.hamster.root.scene.time.delayedCall(duration, onArrive);
  }
}
