export const HAMSTER_MOODS = ['calm', 'excited', 'sleepy', 'curious'] as const;

export type HamsterMood = (typeof HAMSTER_MOODS)[number];

export interface HamsterMoodModifier {
  mood: HamsterMood;
  durationMs: number;
}

const choiceMoodModifiers: Record<string, HamsterMoodModifier> = {
  'feed-now': { mood: 'excited', durationMs: 9000 },
  'wait-observe': { mood: 'curious', durationMs: 10000 },
  'clean-first': { mood: 'calm', durationMs: 12000 },
  'record-incident': { mood: 'sleepy', durationMs: 8000 },
};

const keywordMoodModifiers: Record<string, HamsterMoodModifier> = {
  inspection: { mood: 'curious', durationMs: 7000 },
  odor: { mood: 'sleepy', durationMs: 7000 },
};

export function getChoiceMoodModifier(choiceId: string): HamsterMoodModifier | undefined {
  return choiceMoodModifiers[choiceId];
}

export function getKeywordMoodModifier(keywordId: string): HamsterMoodModifier | undefined {
  return keywordMoodModifiers[keywordId];
}
