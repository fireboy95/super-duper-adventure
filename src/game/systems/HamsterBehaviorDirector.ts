import Phaser from 'phaser';
import { type HamsterMood } from '../ui/hamsterMoodMap';
import { CageView } from '../ui/CageView';
import { HamsterActor } from '../ui/HamsterActor';

const BEHAVIOR_NAMES = ['wander', 'run-wheel', 'eat', 'drink', 'sleep', 'groom', 'hide-in-tunnel'] as const;

export type HamsterBehaviorName = (typeof BEHAVIOR_NAMES)[number];

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
  private readonly moodWeightModifiers: Record<HamsterMood, Partial<Record<HamsterBehaviorName, number>>> = {
    calm: {
      sleep: 2.2,
      groom: 2.4,
      eat: 1.2,
      'run-wheel': 0.6,
      wander: 0.9,
    },
    excited: {
      'run-wheel': 2.5,
      wander: 1.4,
      sleep: 0.35,
      groom: 0.5,
    },
    sleepy: {
      sleep: 3,
      groom: 0.7,
      wander: 0.7,
      'run-wheel': 0.5,
    },
    curious: {
      wander: 1.5,
      'hide-in-tunnel': 1.6,
      drink: 1.15,
      groom: 0.85,
    },
    angry: {
      'run-wheel': 2.8,
      wander: 1.8,
      eat: 0.55,
      drink: 0.65,
      sleep: 0.18,
      groom: 0.5,
    },
  };

  private lastBehavior?: HamsterBehaviorName;
  private mood: HamsterMood = 'calm';
  private moodUntil = 0;

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
      groom: {
        weight: 1.5,
        cooldownMs: 3600,
        run: () => this.runGroom(),
      },
      'hide-in-tunnel': {
        weight: 2,
        cooldownMs: 4500,
        run: () => this.runHideInTunnel(),
      },
    };
  }

  public setMood(mood: HamsterMood, durationMs: number, now: number = Date.now()): void {
    this.mood = mood;
    this.moodUntil = now + Math.max(0, durationMs);
    this.hamster.setMood(mood);
  }

  public tick(now: number): void {
    this.refreshMood(now);
    const behavior = this.pickBehavior(now);
    if (!behavior) {
      return;
    }

    this.applyBehavior(behavior, now, 'tick');
  }

  public triggerBehavior(behavior: HamsterBehaviorName, now: number = Date.now()): boolean {
    this.refreshMood(now);
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
    this.mood = 'calm';
    this.moodUntil = 0;
  }

  private pickBehavior(now: number): HamsterBehaviorName | undefined {
    const available = BEHAVIOR_NAMES
      .map((name) => ({
        name,
        weight: this.getWeightedBehaviorWeight(name),
      }))
      .filter(({ name, weight }) => weight > 0 && !this.getBlockReason(name, now));

    if (available.length === 0) {
      return undefined;
    }

    const totalWeight = available.reduce((sum, candidate) => sum + candidate.weight, 0);
    let roll = this.random() * totalWeight;

    for (const candidate of available) {
      roll -= candidate.weight;
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
    this.moveHamsterNearProp('wheel', () => {
      this.hamster.setState('wheel');
      this.hamster.showPropInteraction('⚙ sprint');
    });
  }

  private runEat(): void {
    this.moveHamsterNearProp('food-bowl', () => {
      this.hamster.setState('eat');
      this.hamster.showPropInteraction('🥕 nibble');
    });
  }

  private runDrink(): void {
    this.moveHamsterNearProp('water-bottle', () => {
      this.hamster.setState('idle');
      this.hamster.showPropInteraction('💧 sip');
    });
  }

  private runGroom(): void {
    this.moveHamsterNearProp('hideout', () => {
      this.hamster.setState('groom');
      this.hamster.showPropInteraction('🧼 tidy');
    });
  }

  private runHideInTunnel(): void {
    this.moveHamsterNearProp('tunnel', () => {
      this.hamster.setState('run');
      this.hamster.showPropInteraction('🕳 dash');
    });
  }

  private moveHamsterNearProp(propId: string, onArrive: () => void): void {
    const prop = this.cageView.getProp(this.getPreferredPropId(propId));
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

  private getWeightedBehaviorWeight(behavior: HamsterBehaviorName): number {
    const baseWeight = this.rules[behavior].weight;
    const modifier = this.moodWeightModifiers[this.mood][behavior] ?? 1;
    return baseWeight * modifier;
  }

  private getPreferredPropId(defaultPropId: string): string {
    if (this.mood === 'excited' && defaultPropId !== 'wheel') {
      return this.random() < 0.45 ? 'wheel' : defaultPropId;
    }

    if (this.mood === 'calm') {
      if (defaultPropId === 'wheel' && this.random() < 0.7) {
        return 'hideout';
      }
      if (defaultPropId === 'tunnel' && this.random() < 0.45) {
        return 'hideout';
      }
    }

    return defaultPropId;
  }

  private refreshMood(now: number): void {
    if (this.mood !== 'calm' && now >= this.moodUntil) {
      this.mood = 'calm';
      this.moodUntil = 0;
      this.hamster.setMood('calm');
    }
  }
}
