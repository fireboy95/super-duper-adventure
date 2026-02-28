import events from '../data/events.json';
import type { SimulationState } from '../types/simulation';

export interface TriggeredEvent {
  id: string;
  dialogId: string;
}

interface EventCondition {
  path: string;
  op: 'lte' | 'gte' | 'eq';
  value: number | string | boolean;
}

interface EventEscalation {
  nextEventId: string;
  ignoreThreshold: number;
}

interface EventDefinition {
  id: string;
  priority: number;
  rarity: number;
  dialogId: string;
  cooldownDays?: number;
  maxRepeats?: number;
  escalation?: EventEscalation;
  conditions: EventCondition[];
}

export class EventSystem {
  private readonly eventDefs: EventDefinition[] = events as EventDefinition[];
  private readonly eventDefsById = new Map(this.eventDefs.map((eventDef) => [eventDef.id, eventDef]));

  poll(state: SimulationState): TriggeredEvent | null {
    const matchedCandidates = this.eventDefs
      .filter((eventDef) => eventDef.conditions.every((condition) => this.matchCondition(state, condition)))
      .map((eventDef) => this.resolveEscalation(eventDef, state))
      .filter((eventDef): eventDef is EventDefinition => Boolean(eventDef))
      .filter((eventDef, index, arr) => arr.findIndex((entry) => entry.id === eventDef.id) === index)
      .sort((a, b) => b.priority - a.priority);

    const chosen = matchedCandidates[0];
    if (!chosen) {
      console.debug('[event] No eligible events after cooldown/escalation checks.');
      return null;
    }

    if (Math.random() > chosen.rarity) {
      console.debug(`[event] Event "${chosen.id}" skipped by rarity roll (${chosen.rarity}).`);
      return null;
    }

    console.debug(`[event] Triggering "${chosen.id}" (dialog: ${chosen.dialogId}).`);
    return { id: chosen.id, dialogId: chosen.dialogId };
  }

  private resolveEscalation(eventDef: EventDefinition, state: SimulationState): EventDefinition | null {
    if (!this.isEligible(eventDef, state)) {
      return null;
    }

    let current = eventDef;
    const visited = new Set<string>([current.id]);

    while (current.escalation) {
      const ignoreCount = state.eventState.ignoreCountsByEventId[current.id] ?? 0;
      if (ignoreCount < current.escalation.ignoreThreshold) break;

      const next = this.eventDefsById.get(current.escalation.nextEventId);
      if (!next) {
        console.warn(`[event] Missing escalation target "${current.escalation.nextEventId}" for "${current.id}".`);
        break;
      }

      if (visited.has(next.id)) {
        console.warn(`[event] Escalation loop detected at "${next.id}".`);
        break;
      }

      if (!next.conditions.every((condition) => this.matchCondition(state, condition))) {
        console.debug(`[event] Escalation target "${next.id}" failed conditions; keeping "${current.id}".`);
        break;
      }

      if (!this.isEligible(next, state)) {
        console.debug(`[event] Escalation target "${next.id}" blocked by cooldown/repeat limits.`);
        return null;
      }

      console.debug(
        `[event] Escalating "${current.id}" -> "${next.id}" at ignoreCount ${ignoreCount}/${current.escalation.ignoreThreshold}.`,
      );

      visited.add(next.id);
      current = next;
    }

    return current;
  }

  private isEligible(eventDef: EventDefinition, state: SimulationState): boolean {
    const cooldownUntilDay = state.eventState.cooldownUntilDayByEventId[eventDef.id] ?? -Infinity;
    if (state.day < cooldownUntilDay) {
      console.debug(`[event] "${eventDef.id}" suppressed by cooldown until day ${cooldownUntilDay}.`);
      return false;
    }

    if (typeof eventDef.maxRepeats === 'number') {
      const seenTriggers = state.eventState.triggerCountsByEventId[eventDef.id] ?? 0;
      if (seenTriggers >= eventDef.maxRepeats) {
        console.debug(`[event] "${eventDef.id}" suppressed by maxRepeats (${seenTriggers}/${eventDef.maxRepeats}).`);
        return false;
      }
    }

    return true;
  }


  getCooldownDays(eventId: string): number {
    return this.eventDefsById.get(eventId)?.cooldownDays ?? 0;
  }

  private matchCondition(state: SimulationState, condition: EventCondition): boolean {
    const target = condition.path.split('.').reduce<unknown>((acc, key) => {
      if (typeof acc === 'object' && acc !== null && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, state);

    switch (condition.op) {
      case 'eq':
        return target === condition.value;
      case 'lte':
        return typeof target === 'number' && typeof condition.value === 'number' && target <= condition.value;
      case 'gte':
        return typeof target === 'number' && typeof condition.value === 'number' && target >= condition.value;
      default:
        return false;
    }
  }
}
