import defaults from '../data/stats.defaults.json';
import type { DialogOptionEffects } from './DialogueSystem';
import type { HamsterStats, PlayerActionType, SimulationState } from '../types/simulation';

const MINUTES_PER_DAY = 24 * 60;
const CAGE_DIRT_ACCUMULATION_PER_SECOND = 0.05;
const BODY_CLEANLINESS_DECAY_PER_SECOND = 0.025;

export class SimulationManager {
  private state: SimulationState;

  constructor(seedState?: SimulationState) {
    this.state = seedState ?? structuredClone(defaults as SimulationState);
    this.state.eventState ??= {
      lastTriggeredAtMinutesByEventId: {},
      lastTriggeredDayByEventId: {},
      ignoreCountsByEventId: {},
      triggerCountsByEventId: {},
      cooldownUntilDayByEventId: {},
    };
  }

  tick(deltaSeconds: number): void {
    if (!this.state.hamster.alive) return;

    const deltaMinutes = deltaSeconds / 2;
    const nextTimeOfDayMinutes = this.state.timeOfDayMinutes + deltaMinutes;

    if (nextTimeOfDayMinutes >= MINUTES_PER_DAY) {
      const elapsedDays = Math.floor(nextTimeOfDayMinutes / MINUTES_PER_DAY);
      this.state.day += elapsedDays;
      this.state.progression.daysSurvived += elapsedDays;
    }

    this.state.timeOfDayMinutes = nextTimeOfDayMinutes % MINUTES_PER_DAY;

    this.changeStat('hunger', 0.4 * deltaSeconds);
    this.changeStat('thirst', 0.45 * deltaSeconds);
    this.changeStat('energy', this.isNightTime() ? -0.3 * deltaSeconds : 0.2 * deltaSeconds);

    this.state.cage.cleanliness = clamp(this.state.cage.cleanliness - CAGE_DIRT_ACCUMULATION_PER_SECOND * deltaSeconds, 0, 100);
    this.changeStat('cleanlinessBody', -BODY_CLEANLINESS_DECAY_PER_SECOND * deltaSeconds);

    if (this.state.cage.cleanliness < 50) {
      this.changeStat('stress', 0.08 * deltaSeconds);
      this.changeStat('mood', -0.04 * deltaSeconds);
    }

    if (this.state.cage.cleanliness < 30) {
      this.changeStat('health', -0.15 * deltaSeconds);
      this.changeStat('stress', 0.2 * deltaSeconds);
    }

    if (this.state.cage.cleanliness < 20) {
      this.changeStat('health', -0.18 * deltaSeconds);
      this.changeStat('mood', -0.1 * deltaSeconds);
      this.changeStat('stress', 0.12 * deltaSeconds);
    }

    if (this.state.hamster.stats.cleanlinessBody < 40) {
      this.changeStat('mood', -0.08 * deltaSeconds);
      this.changeStat('stress', 0.08 * deltaSeconds);
    }

    if (this.state.hamster.stats.cleanlinessBody < 20) {
      this.changeStat('health', -0.08 * deltaSeconds);
      this.changeStat('stress', 0.12 * deltaSeconds);
    }

    if (this.state.hamster.flags.hyperactive) {
      this.changeStat('energy', -0.3 * deltaSeconds);
      this.changeStat('stress', 0.25 * deltaSeconds);
    }

    const { grudge } = this.state.hamster.memory;
    if (grudge >= 6) {
      this.changeStat('stress', 0.08 * deltaSeconds * grudge);
      this.changeStat('mood', -0.05 * deltaSeconds * grudge);
    }

    if (this.state.hamster.stats.health <= 0) {
      this.state.hamster.alive = false;
      this.state.progression.endingId = 'ending_neglect';
    }
  }

  applyPlayerAction(action: PlayerActionType): void {
    if (!this.state.hamster.alive) return;

    switch (action) {
      case 'feed_standard':
        this.changeStat('hunger', -14);
        this.changeStat('mood', 4);
        this.incrementInventory('food_standard', -1);
        break;
      case 'feed_sweet':
        this.changeStat('hunger', -22);
        this.changeStat('mood', 8);
        this.changeStat('stress', 3);
        this.state.hamster.flags.hyperactive = true;
        this.incrementInventory('food_sweet', -1);
        break;
      case 'refill_water':
        this.changeStat('thirst', -20);
        this.changeStat('mood', 2);
        break;
      case 'clean_cage':
        this.state.cage.cleanliness = clamp(this.state.cage.cleanliness + 30, 0, 100);
        this.changeStat('stress', -5);
        this.changeStat('mood', 2);
        break;
      case 'handle_hamster': {
        const { timidBold, neuroticChill } = this.state.hamster.traits;
        const { trust } = this.state.hamster.stats;
        const { grudge } = this.state.hamster.memory;
        const isRelaxed = timidBold + neuroticChill + trust * 0.07 - grudge * 0.2 >= 0;
        const grudgePenalty = clamp(grudge / 20, 0, 0.85);

        if (isRelaxed) {
          this.changeStat('stress', 1 + grudge * 0.2);
          this.changeStat('trust', 2 + timidBold * 0.8);
          this.changeStat('mood', 5 * (1 - grudgePenalty));
          this.changeMemory('positiveInteractions', 1);
          this.changeMemory('grudge', -Math.max(1, Math.round((timidBold + 1) * 0.75)));
        } else {
          this.changeStat('stress', 4 + grudge * 0.45 + Math.max(0, -neuroticChill));
          this.changeStat('trust', -2.5 - Math.max(0, -timidBold));
          this.changeStat('mood', -2 - grudge * 0.15);
          this.changeMemory('negativeInteractions', 1);
          this.changeMemory('grudge', 1 + Math.round(Math.max(0, -timidBold)));
        }
        break;
      }
      default:
        break;
    }
  }



  applyDialogEffects(effects: DialogOptionEffects | undefined): void {
    if (!effects || !this.state.hamster.alive) return;

    if (effects.stats) {
      for (const [rawStat, delta] of Object.entries(effects.stats)) {
        if (typeof delta !== 'number') continue;
        const stat = rawStat as keyof HamsterStats;
        if (stat in this.state.hamster.stats) this.changeStat(stat, delta);
      }
    }

    if (effects.memory) {
      for (const [rawMemoryKey, delta] of Object.entries(effects.memory)) {
        if (typeof delta !== 'number') continue;
        const memoryKey = rawMemoryKey as keyof SimulationState['hamster']['memory'];
        if (!(memoryKey in this.state.hamster.memory)) continue;
        const current = this.state.hamster.memory[memoryKey];
        this.state.hamster.memory[memoryKey] = Math.max(0, current + delta);
      }
    }

    if (effects.flags) {
      for (const [rawFlagKey, value] of Object.entries(effects.flags)) {
        if (typeof value !== 'boolean') continue;
        const flagKey = rawFlagKey as keyof SimulationState['hamster']['flags'];
        if (flagKey in this.state.hamster.flags) this.state.hamster.flags[flagKey] = value;
      }
    }

    if (effects.progression) {
      const progression = effects.progression;

      if (typeof progression.daysSurvivedDelta === 'number') {
        this.state.progression.daysSurvived = Math.max(0, this.state.progression.daysSurvived + progression.daysSurvivedDelta);
      }

      this.pushUnique(this.state.progression.unlockedItems, progression.unlockedItemsAdd);
      this.pushUnique(this.state.progression.seenDialogIds, progression.seenDialogIdsAdd);
      this.pushUnique(this.state.progression.seenEventIds, progression.seenEventIdsAdd);

      if (progression.ignoredEventIdsAdd) {
        this.registerIgnoredEvents(progression.ignoredEventIdsAdd);
      }

      if (typeof progression.endingId === 'string' || progression.endingId === null) {
        this.state.progression.endingId = progression.endingId;
      }
    }
  }


  registerTriggeredEvent(eventId: string, cooldownDays = 0): void {
    this.pushUnique(this.state.progression.seenEventIds, [eventId]);

    const nowAbsoluteMinutes = this.state.day * MINUTES_PER_DAY + this.state.timeOfDayMinutes;
    this.state.eventState.lastTriggeredAtMinutesByEventId[eventId] = nowAbsoluteMinutes;
    this.state.eventState.lastTriggeredDayByEventId[eventId] = this.state.day;
    this.state.eventState.triggerCountsByEventId[eventId] = (this.state.eventState.triggerCountsByEventId[eventId] ?? 0) + 1;

    if (cooldownDays > 0) {
      this.state.eventState.cooldownUntilDayByEventId[eventId] = this.state.day + cooldownDays;
    }

    console.debug(
      `[event] State recorded trigger for "${eventId}". count=${this.state.eventState.triggerCountsByEventId[eventId]} cooldownUntil=${this.state.eventState.cooldownUntilDayByEventId[eventId] ?? this.state.day}`,
    );
  }

  registerIgnoredEvents(eventIds: string[]): void {
    for (const eventId of eventIds) {
      this.state.eventState.ignoreCountsByEventId[eventId] = (this.state.eventState.ignoreCountsByEventId[eventId] ?? 0) + 1;
      console.debug(`[event] Ignore counter incremented for "${eventId}" -> ${this.state.eventState.ignoreCountsByEventId[eventId]}.`);
    }
  }

  getVisibleStats(): Pick<HamsterStats, 'hunger' | 'thirst' | 'energy' | 'mood' | 'health'> & {
    cleanliness: number;
    cleanlinessBody: number;
    stress: number;
    trust: number;
    grudge: number;
  } {
    return {
      hunger: this.state.hamster.stats.hunger,
      thirst: this.state.hamster.stats.thirst,
      energy: this.state.hamster.stats.energy,
      mood: this.state.hamster.stats.mood,
      health: this.state.hamster.stats.health,
      cleanliness: this.state.cage.cleanliness,
      cleanlinessBody: this.state.hamster.stats.cleanlinessBody,
      stress: this.state.hamster.stats.stress,
      trust: this.state.hamster.stats.trust,
      grudge: this.state.hamster.memory.grudge,
    };
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }

  getTimeOfDayRatio(): number {
    return this.state.timeOfDayMinutes / MINUTES_PER_DAY;
  }

  isNightTime(): boolean {
    return this.state.timeOfDayMinutes >= 20 * 60 || this.state.timeOfDayMinutes < 6 * 60;
  }



  private pushUnique(target: string[], values?: string[]): void {
    if (!values) return;

    for (const value of values) {
      if (!target.includes(value)) target.push(value);
    }
  }

  private incrementInventory(itemId: string, amount: number): void {
    const current = this.state.inventory[itemId] ?? 0;
    this.state.inventory[itemId] = Math.max(current + amount, 0);
  }

  private changeStat(stat: keyof HamsterStats, delta: number): void {
    const value = this.state.hamster.stats[stat] + delta;
    this.state.hamster.stats[stat] = clamp(value, 0, 100);
  }

  private changeMemory(memoryKey: keyof SimulationState['hamster']['memory'], delta: number): void {
    this.state.hamster.memory[memoryKey] = clamp(this.state.hamster.memory[memoryKey] + delta, 0, 100);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
