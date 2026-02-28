import type { SimulationState } from '../types/simulation';

const SAVE_KEY = 'hamster_keeper_save_v1';

export class SaveSystem {
  save(state: SimulationState): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  load(): SimulationState | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SimulationState;
    } catch {
      return null;
    }
  }
}
