import dialogs from '../data/dialogs.json';
import type { HamsterStats, SimulationState } from '../types/simulation';

interface RawDialogOption {
  id?: unknown;
  label?: unknown;
  effects?: unknown;
}

interface RawDialogEntry {
  id?: unknown;
  title?: unknown;
  speaker?: unknown;
  pages?: unknown;
  options?: unknown;
}

interface RawDialogOptionEffects {
  stats?: unknown;
  memory?: unknown;
  flags?: unknown;
  progression?: unknown;
  nextDialogId?: unknown;
  followUpDialogIds?: unknown;
}

export interface DialogProgressionEffects {
  daysSurvivedDelta?: number;
  unlockedItemsAdd?: string[];
  seenDialogIdsAdd?: string[];
  seenEventIdsAdd?: string[];
  ignoredEventIdsAdd?: string[];
  endingId?: string | null;
}

export interface DialogOptionEffects {
  stats?: Partial<Record<keyof HamsterStats, number>>;
  memory?: Partial<Record<keyof SimulationState['hamster']['memory'], number>>;
  flags?: Partial<Record<keyof SimulationState['hamster']['flags'], boolean>>;
  progression?: DialogProgressionEffects;
  nextDialogId?: string | null;
  followUpDialogIds?: string[];
}

export interface DialogOption {
  id: string;
  label: string;
  effects?: DialogOptionEffects;
}

export interface DialogEntry {
  id: string;
  title: string;
  speaker: string;
  pages: string[];
  options: DialogOption[];
}

const statKeys = new Set<keyof HamsterStats>([
  'hunger',
  'thirst',
  'energy',
  'health',
  'cleanlinessBody',
  'mood',
  'stress',
  'trust',
]);

const memoryKeys = new Set<keyof SimulationState['hamster']['memory']>([
  'positiveInteractions',
  'negativeInteractions',
  'grudge',
]);

const flagKeys = new Set<keyof SimulationState['hamster']['flags']>(['hyperactive', 'mildIllness']);

export class DialogueSystem {
  private readonly dialogMap: Map<string, DialogEntry>;

  constructor(source: unknown = dialogs) {
    this.dialogMap = new Map(this.parseDialogs(source).map((dialog) => [dialog.id, dialog]));
  }

  getById(id: string): DialogEntry | null {
    return this.dialogMap.get(id) ?? null;
  }

  private parseDialogs(source: unknown): DialogEntry[] {
    if (!Array.isArray(source)) {
      console.warn('[dialog] Invalid dialogs payload, expected array.');
      return [];
    }

    const parsed: DialogEntry[] = [];
    for (const raw of source as RawDialogEntry[]) {
      const dialog = this.parseDialog(raw);
      if (dialog) parsed.push(dialog);
    }

    return parsed;
  }

  private parseDialog(raw: RawDialogEntry): DialogEntry | null {
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.speaker !== 'string') {
      console.warn('[dialog] Skipping malformed dialog entry.', raw);
      return null;
    }

    if (!Array.isArray(raw.pages) || raw.pages.some((page) => typeof page !== 'string')) {
      console.warn(`[dialog] Dialog "${raw.id}" has invalid pages array.`);
      return null;
    }

    const options = Array.isArray(raw.options)
      ? raw.options
          .map((option) => this.parseOption(raw.id as string, option as RawDialogOption))
          .filter((option): option is DialogOption => Boolean(option))
      : [];

    return {
      id: raw.id,
      title: raw.title,
      speaker: raw.speaker,
      pages: raw.pages,
      options,
    };
  }

  private parseOption(dialogId: string, raw: RawDialogOption): DialogOption | null {
    if (typeof raw.id !== 'string' || typeof raw.label !== 'string') {
      console.warn(`[dialog] Dialog "${dialogId}" contains an invalid option.`, raw);
      return null;
    }

    return {
      id: raw.id,
      label: raw.label,
      effects: this.parseEffects(raw.effects, dialogId, raw.id),
    };
  }

  private parseEffects(raw: unknown, dialogId: string, optionId: string): DialogOptionEffects | undefined {
    if (!raw || typeof raw !== 'object') return undefined;

    const effects = raw as RawDialogOptionEffects;
    const parsed: DialogOptionEffects = {};

    const stats = this.parseNumericRecord(effects.stats, statKeys, 'stats', dialogId, optionId);
    if (stats) parsed.stats = stats;

    const memory = this.parseNumericRecord(effects.memory, memoryKeys, 'memory', dialogId, optionId);
    if (memory) parsed.memory = memory;

    const flags = this.parseBooleanRecord(effects.flags, flagKeys, 'flags', dialogId, optionId);
    if (flags) parsed.flags = flags;

    if (effects.progression && typeof effects.progression === 'object') {
      const progression = effects.progression as Record<string, unknown>;
      const parsedProgression: DialogProgressionEffects = {};

      if (typeof progression.daysSurvivedDelta === 'number') {
        parsedProgression.daysSurvivedDelta = progression.daysSurvivedDelta;
      }
      parsedProgression.unlockedItemsAdd = this.parseStringArray(progression.unlockedItemsAdd);
      parsedProgression.seenDialogIdsAdd = this.parseStringArray(progression.seenDialogIdsAdd);
      parsedProgression.seenEventIdsAdd = this.parseStringArray(progression.seenEventIdsAdd);
      parsedProgression.ignoredEventIdsAdd = this.parseStringArray(progression.ignoredEventIdsAdd);

      if (typeof progression.endingId === 'string' || progression.endingId === null) {
        parsedProgression.endingId = progression.endingId;
      }

      if (Object.keys(parsedProgression).length > 0) {
        parsed.progression = parsedProgression;
      }
    }

    if (typeof effects.nextDialogId === 'string' || effects.nextDialogId === null) {
      parsed.nextDialogId = effects.nextDialogId;
    }

    const followUpDialogIds = this.parseStringArray(effects.followUpDialogIds);
    if (followUpDialogIds && followUpDialogIds.length > 0) {
      parsed.followUpDialogIds = followUpDialogIds;
    }

    if (Object.keys(parsed).length === 0) {
      console.warn(`[dialog] Effects for ${dialogId}/${optionId} are present but invalid, ignoring.`);
      return undefined;
    }

    return parsed;
  }

  private parseNumericRecord<T extends string>(
    value: unknown,
    allowedKeys: Set<T>,
    fieldName: string,
    dialogId: string,
    optionId: string,
  ): Partial<Record<T, number>> | undefined {
    if (!value || typeof value !== 'object') return undefined;

    const parsed: Partial<Record<T, number>> = {};
    for (const [rawKey, rawDelta] of Object.entries(value as Record<string, unknown>)) {
      if (!allowedKeys.has(rawKey as T)) {
        console.warn(`[dialog] Unknown ${fieldName} key "${rawKey}" in ${dialogId}/${optionId}, skipping.`);
        continue;
      }

      if (typeof rawDelta !== 'number') {
        console.warn(`[dialog] Non-numeric ${fieldName} delta for "${rawKey}" in ${dialogId}/${optionId}, skipping.`);
        continue;
      }

      parsed[rawKey as T] = rawDelta;
    }

    return Object.keys(parsed).length > 0 ? parsed : undefined;
  }

  private parseBooleanRecord<T extends string>(
    value: unknown,
    allowedKeys: Set<T>,
    fieldName: string,
    dialogId: string,
    optionId: string,
  ): Partial<Record<T, boolean>> | undefined {
    if (!value || typeof value !== 'object') return undefined;

    const parsed: Partial<Record<T, boolean>> = {};
    for (const [rawKey, rawFlag] of Object.entries(value as Record<string, unknown>)) {
      if (!allowedKeys.has(rawKey as T)) {
        console.warn(`[dialog] Unknown ${fieldName} key "${rawKey}" in ${dialogId}/${optionId}, skipping.`);
        continue;
      }

      if (typeof rawFlag !== 'boolean') {
        console.warn(`[dialog] Non-boolean ${fieldName} value for "${rawKey}" in ${dialogId}/${optionId}, skipping.`);
        continue;
      }

      parsed[rawKey as T] = rawFlag;
    }

    return Object.keys(parsed).length > 0 ? parsed : undefined;
  }

  private parseStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const filtered = value.filter((entry): entry is string => typeof entry === 'string');
    return filtered.length > 0 ? filtered : undefined;
  }
}
