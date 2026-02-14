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

export const zIdentityAnchors = z.object({
  hp: z.number().finite(),
  inventory: z.array(z.string().min(1)),
  relics: z.array(z.string().min(1)),
  flags: z.record(z.boolean())
});

export const zUniverseState = z.object({
  tick: z.number().int().nonnegative(),
  activeLensId: z.string().min(1),
  frame: zUFrame,
  anchors: zIdentityAnchors,
  lensStates: z.record(z.unknown()),
  lensOutcomes: z.record(z.unknown())
});

export const zDeltaU = z.object({
  tick: z.number().int().nonnegative().optional(),
  activeLensId: z.string().min(1).optional(),
  frame: zUFrame.optional(),
  anchors: zIdentityAnchors.partial().optional(),
  lensStates: z.record(z.unknown()).optional(),
  lensOutcomes: z.record(z.unknown()).optional()
});

export type UVec2 = z.infer<typeof zUVec2>;
export type UEntityState = z.infer<typeof zUEntityState>;
export type UFrame = z.infer<typeof zUFrame>;
export type IdentityAnchors = z.infer<typeof zIdentityAnchors>;
export type UniverseState = z.infer<typeof zUniverseState>;
export type DeltaU = z.infer<typeof zDeltaU>;

export function parseFrame(input: unknown): UFrame {
  return zUFrame.parse(input);
}

export function parseUniverseState(input: unknown): UniverseState {
  return zUniverseState.parse(input);
}

export function parseDeltaU(input: unknown): DeltaU {
  return zDeltaU.parse(input);
}
