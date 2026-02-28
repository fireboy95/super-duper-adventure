import events from '../data/events.json';
import type { SimulationState } from '../types/simulation';

export interface TriggeredEvent {
  id: string;
  dialogId: string;
}

interface EventDefinition {
  id: string;
  priority: number;
  rarity: number;
  dialogId: string;
  conditions: Array<{
    path: string;
    op: 'lte' | 'gte' | 'eq';
    value: number | string | boolean;
  }>;
}

export class EventSystem {
  private readonly eventDefs: EventDefinition[] = events as EventDefinition[];

  poll(state: SimulationState): TriggeredEvent | null {
    const matched = this.eventDefs
      .filter((eventDef) => eventDef.conditions.every((condition) => this.matchCondition(state, condition)))
      .sort((a, b) => b.priority - a.priority);

    const first = matched[0];
    if (!first) return null;
    if (Math.random() > first.rarity) return null;

    return { id: first.id, dialogId: first.dialogId };
  }

  private matchCondition(state: SimulationState, condition: EventDefinition['conditions'][number]): boolean {
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
