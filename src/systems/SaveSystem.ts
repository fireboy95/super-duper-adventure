import type { SimulationState } from '../types/simulation';
import defaults from '../data/stats.defaults.json';

const SAVE_KEY = 'hamster_keeper_save_v1';
const CURRENT_SCHEMA_VERSION = (defaults as SimulationState).version;

type UnknownRecord = Record<string, unknown>;

export class SaveSystem {
  save(state: Readonly<SimulationState>): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  hasSave(): boolean {
    return this.load() !== null;
  }

  load(): SimulationState | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      return this.validateAndMigrate(parsed);
    } catch {
      return null;
    }
  }

  private validateAndMigrate(rawState: unknown): SimulationState | null {
    if (!rawState || typeof rawState !== 'object') return null;

    const migrated = this.migrateByVersion(rawState as UnknownRecord);
    const normalized = this.normalizeToDefaults(migrated);
    return normalized;
  }

  private migrateByVersion(rawState: UnknownRecord): UnknownRecord {
    const migrated = structuredClone(rawState);
    const rawVersion = migrated.version;
    const version = typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : 0;

    if (version < 1) {
      const progression = this.asRecord(migrated.progression);
      progression.seenDialogIds = this.asStringArray(progression.seenDialogIds);
      progression.seenEventIds = this.asStringArray(progression.seenEventIds);
      progression.endingId = typeof progression.endingId === 'string' || progression.endingId === null ? progression.endingId : null;
      migrated.progression = progression;
    }

    migrated.version = CURRENT_SCHEMA_VERSION;
    return migrated;
  }

  private normalizeToDefaults(rawState: UnknownRecord): SimulationState {
    const fallback = structuredClone(defaults as SimulationState);
    const result = fallback as unknown as UnknownRecord;

    const source = rawState as UnknownRecord;

    this.copyNumber(source, result, 'day');
    this.copyNumber(source, result, 'timeOfDayMinutes');

    const hamster = this.asRecord(source.hamster);
    const hamsterOut = this.asRecord(result.hamster);
    this.copyString(hamster, hamsterOut, 'name');
    this.copyNumber(hamster, hamsterOut, 'ageDays');
    this.copyBoolean(hamster, hamsterOut, 'alive');

    this.copyRecord(hamster, hamsterOut, 'traits', ['timidBold', 'gluttonousFinicky', 'neuroticChill'], 'number');
    this.copyRecord(hamster, hamsterOut, 'stats', ['hunger', 'thirst', 'energy', 'health', 'cleanlinessBody', 'mood', 'stress', 'trust'], 'number');
    this.copyRecord(hamster, hamsterOut, 'memory', ['positiveInteractions', 'negativeInteractions', 'grudge'], 'number');
    this.copyRecord(hamster, hamsterOut, 'flags', ['hyperactive', 'mildIllness'], 'boolean');

    const cage = this.asRecord(source.cage);
    const cageOut = this.asRecord(result.cage);
    this.copyNumber(cage, cageOut, 'cleanliness');
    this.copyNumber(cage, cageOut, 'noise');
    this.copyNumber(cage, cageOut, 'light');
    if (cage.temperatureBand === 'cold' || cage.temperatureBand === 'normal' || cage.temperatureBand === 'hot') {
      cageOut.temperatureBand = cage.temperatureBand;
    }

    const inventory = this.asRecord(source.inventory);
    const inventoryOut = this.asRecord(result.inventory);
    for (const [itemId, count] of Object.entries(inventory)) {
      if (typeof count === 'number' && Number.isFinite(count)) inventoryOut[itemId] = count;
    }

    const progression = this.asRecord(source.progression);
    const progressionOut = this.asRecord(result.progression);
    this.copyNumber(progression, progressionOut, 'daysSurvived');
    progressionOut.unlockedItems = this.asStringArray(progression.unlockedItems);
    progressionOut.seenDialogIds = this.asStringArray(progression.seenDialogIds);
    progressionOut.seenEventIds = this.asStringArray(progression.seenEventIds);
    progressionOut.endingId = typeof progression.endingId === 'string' || progression.endingId === null ? progression.endingId : null;

    const eventState = this.asRecord(source.eventState);
    const eventStateOut = this.asRecord(result.eventState);
    eventStateOut.lastTriggeredAtMinutesByEventId = this.asNumberRecord(eventState.lastTriggeredAtMinutesByEventId);
    eventStateOut.lastTriggeredDayByEventId = this.asNumberRecord(eventState.lastTriggeredDayByEventId);
    eventStateOut.ignoreCountsByEventId = this.asNumberRecord(eventState.ignoreCountsByEventId);
    eventStateOut.triggerCountsByEventId = this.asNumberRecord(eventState.triggerCountsByEventId);
    eventStateOut.cooldownUntilDayByEventId = this.asNumberRecord(eventState.cooldownUntilDayByEventId);

    result.version = CURRENT_SCHEMA_VERSION;
    return result as unknown as SimulationState;
  }

  private copyNumber(source: UnknownRecord, target: UnknownRecord, key: string): void {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) target[key] = value;
  }

  private copyString(source: UnknownRecord, target: UnknownRecord, key: string): void {
    if (typeof source[key] === 'string') target[key] = source[key];
  }

  private copyBoolean(source: UnknownRecord, target: UnknownRecord, key: string): void {
    if (typeof source[key] === 'boolean') target[key] = source[key];
  }

  private copyRecord(source: UnknownRecord, target: UnknownRecord, key: string, nestedKeys: string[], valueType: 'number' | 'boolean'): void {
    const sourceRecord = this.asRecord(source[key]);
    const targetRecord = this.asRecord(target[key]);
    for (const nestedKey of nestedKeys) {
      const value = sourceRecord[nestedKey];
      if (valueType === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        targetRecord[nestedKey] = value;
      }
      if (valueType === 'boolean' && typeof value === 'boolean') {
        targetRecord[nestedKey] = value;
      }
    }
  }

  private asRecord(value: unknown): UnknownRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as UnknownRecord;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private asNumberRecord(value: unknown): Record<string, number> {
    const record = this.asRecord(value);
    const parsed: Record<string, number> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (typeof entry === 'number' && Number.isFinite(entry)) parsed[key] = entry;
    }
    return parsed;
  }
}
