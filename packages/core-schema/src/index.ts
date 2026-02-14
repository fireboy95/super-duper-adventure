import { z } from 'zod';

export const zUVec2 = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const zUEntityState = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  pos: zUVec2,
  tick: z.number().int().nonnegative()
});

export const zUFrame = z.object({
  tick: z.number().int().nonnegative(),
  entities: z.array(zUEntityState)
});

export const zUnlockTable = z.object({
  unlocked: z.array(z.string().min(1)).default([]),
  available: z.array(z.string().min(1)).default([])
});

export const zMetaUnlockTables = z.object({
  lenses: zUnlockTable,
  characters: zUnlockTable,
  mutators: zUnlockTable,
  relicStarts: zUnlockTable
});

export const zMetaProgressionData = z.object({
  profileId: z.string().min(1),
  xp: z.number().int().nonnegative(),
  unlocks: zMetaUnlockTables,
  updatedAtMs: z.number().int().nonnegative()
});

export const zMetaRewardPackage = z.object({
  xpGranted: z.number().int().nonnegative(),
  unlocks: z.object({
    lenses: z.array(z.string().min(1)).default([]),
    characters: z.array(z.string().min(1)).default([]),
    mutators: z.array(z.string().min(1)).default([]),
    relicStarts: z.array(z.string().min(1)).default([])
  })
});

export type UVec2 = z.infer<typeof zUVec2>;
export type UEntityState = z.infer<typeof zUEntityState>;
export type UFrame = z.infer<typeof zUFrame>;
export type UnlockTable = z.infer<typeof zUnlockTable>;
export type MetaUnlockTables = z.infer<typeof zMetaUnlockTables>;
export type MetaProgressionData = z.infer<typeof zMetaProgressionData>;
export type MetaRewardPackage = z.infer<typeof zMetaRewardPackage>;

export function parseFrame(input: unknown): UFrame {
  return zUFrame.parse(input);
}

export function parseMetaProgressionData(input: unknown): MetaProgressionData {
  return zMetaProgressionData.parse(input);
}

export function parseMetaRewardPackage(input: unknown): MetaRewardPackage {
  return zMetaRewardPackage.parse(input);
}
