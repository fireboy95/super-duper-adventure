import {
  parseMetaProgressionData,
  type MetaProgressionData,
  type MetaRewardPackage
} from '@adventure/core-schema';

export interface MetaProgressionPersistence {
  load(profileId: string): Promise<MetaProgressionData | null>;
  save(profile: MetaProgressionData): Promise<void>;
}

export class InMemoryMetaProgressionPersistence implements MetaProgressionPersistence {
  private readonly profiles = new Map<string, MetaProgressionData>();

  async load(profileId: string): Promise<MetaProgressionData | null> {
    return this.profiles.get(profileId) ?? null;
  }

  async save(profile: MetaProgressionData): Promise<void> {
    this.profiles.set(profile.profileId, parseMetaProgressionData(profile));
  }
}

export function createDefaultMetaProfile(profileId: string, nowMs: number): MetaProgressionData {
  return {
    profileId,
    xp: 0,
    unlocks: {
      lenses: {
        unlocked: ['lens/echo'],
        available: ['lens/echo', 'lens/arcade-skirmish', 'lens/stealth-infiltration']
      },
      characters: {
        unlocked: ['character/scout'],
        available: ['character/scout', 'character/tank']
      },
      mutators: { unlocked: [], available: ['mutator/double-enemies', 'mutator/volatile-world'] },
      relicStarts: {
        unlocked: ['relic/health-vial'],
        available: ['relic/health-vial', 'relic/smoke-bomb']
      }
    },
    updatedAtMs: nowMs
  };
}

export function applyMetaRewards(
  profile: MetaProgressionData,
  rewards: MetaRewardPackage,
  nowMs: number
): MetaProgressionData {
  const dedupe = (items: string[]) => [...new Set(items)];

  return {
    ...profile,
    xp: profile.xp + rewards.xpGranted,
    unlocks: {
      lenses: {
        ...profile.unlocks.lenses,
        unlocked: dedupe([...profile.unlocks.lenses.unlocked, ...rewards.unlocks.lenses])
      },
      characters: {
        ...profile.unlocks.characters,
        unlocked: dedupe([...profile.unlocks.characters.unlocked, ...rewards.unlocks.characters])
      },
      mutators: {
        ...profile.unlocks.mutators,
        unlocked: dedupe([...profile.unlocks.mutators.unlocked, ...rewards.unlocks.mutators])
      },
      relicStarts: {
        ...profile.unlocks.relicStarts,
        unlocked: dedupe([...profile.unlocks.relicStarts.unlocked, ...rewards.unlocks.relicStarts])
      }
    },
    updatedAtMs: nowMs
  };
}
