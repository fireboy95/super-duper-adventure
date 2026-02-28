export interface Traits {
  timidBold: number;
  gluttonousFinicky: number;
  neuroticChill: number;
}

export interface HamsterStats {
  hunger: number;
  thirst: number;
  energy: number;
  health: number;
  cleanlinessBody: number;
  mood: number;
  stress: number;
  trust: number;
}

export interface SimulationState {
  version: number;
  day: number;
  timeOfDayMinutes: number;
  hamster: {
    name: string;
    ageDays: number;
    alive: boolean;
    traits: Traits;
    stats: HamsterStats;
    memory: {
      positiveInteractions: number;
      negativeInteractions: number;
      grudge: number;
    };
    flags: {
      hyperactive: boolean;
      mildIllness: boolean;
    };
  };
  cage: {
    cleanliness: number;
    temperatureBand: 'cold' | 'normal' | 'hot';
    noise: number;
    light: number;
  };
  inventory: Record<string, number>;
  progression: {
    daysSurvived: number;
    unlockedItems: string[];
    seenDialogIds: string[];
    seenEventIds: string[];
    endingId: string | null;
  };
}

export type PlayerActionType = 'feed_standard' | 'feed_sweet' | 'refill_water' | 'clean_cage' | 'handle_hamster';
