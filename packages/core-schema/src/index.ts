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

export type UVec2 = z.infer<typeof zUVec2>;
export type UEntityState = z.infer<typeof zUEntityState>;
export type UFrame = z.infer<typeof zUFrame>;

export function parseFrame(input: unknown): UFrame {
  return zUFrame.parse(input);
}
