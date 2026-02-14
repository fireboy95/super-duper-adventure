import type { DeltaU, IdentityAnchors, UniverseState, UFrame } from '@adventure/core-schema';

export interface LensTransitionContext {
  fromLensId: string;
  toLensId: string;
  tick: number;
  anchors: IdentityAnchors;
}

export interface DecodedLensState {
  frame: UFrame;
  state: unknown;
  outcomes: unknown;
}

export interface LensMappingRule {
  decodeMap(input: UniverseState, context: LensTransitionContext): DecodedLensState;
  encodeMap(decoded: DecodedLensState, context: LensTransitionContext): DeltaU;
}

export interface LensMappingRegistry {
  decodeMap: Record<string, LensMappingRule['decodeMap']>;
  encodeMap: Record<string, LensMappingRule['encodeMap']>;
}

export interface LensTransitionResult {
  context: LensTransitionContext;
  deltaU: DeltaU;
  nextU: UniverseState;
}

function toDeterministicAnchors(anchors: IdentityAnchors): IdentityAnchors {
  return {
    hp: anchors.hp,
    inventory: [...new Set(anchors.inventory)].sort(),
    relics: [...new Set(anchors.relics)].sort(),
    flags: Object.keys(anchors.flags)
      .sort()
      .reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = anchors.flags[key] ?? false;
        return acc;
      }, {})
  };
}

export function computeLensTransitionContext(
  input: UniverseState,
  toLensId: string
): LensTransitionContext {
  return {
    fromLensId: input.activeLensId,
    toLensId,
    tick: input.tick,
    anchors: toDeterministicAnchors(input.anchors)
  };
}

function fallbackDecode(input: UniverseState, context: LensTransitionContext): DecodedLensState {
  const state = input.lensStates[context.fromLensId] ?? input.lensStates[input.activeLensId] ?? {};
  const outcomes = input.lensOutcomes[context.fromLensId] ?? {};

  return {
    frame: input.frame,
    state,
    outcomes
  };
}

function fallbackEncode(decoded: DecodedLensState, context: LensTransitionContext): DeltaU {
  return {
    activeLensId: context.toLensId,
    frame: decoded.frame,
    lensStates: {
      [context.toLensId]: decoded.state
    },
    lensOutcomes: {
      [context.toLensId]: decoded.outcomes
    }
  };
}

export function applyDeltaU(input: UniverseState, delta: DeltaU): UniverseState {
  return {
    tick: delta.tick ?? input.tick,
    activeLensId: delta.activeLensId ?? input.activeLensId,
    frame: delta.frame ?? input.frame,
    anchors: {
      hp: delta.anchors?.hp ?? input.anchors.hp,
      inventory: delta.anchors?.inventory ?? input.anchors.inventory,
      relics: delta.anchors?.relics ?? input.anchors.relics,
      flags: {
        ...input.anchors.flags,
        ...(delta.anchors?.flags ?? {})
      }
    },
    lensStates: {
      ...input.lensStates,
      ...(delta.lensStates ?? {})
    },
    lensOutcomes: {
      ...input.lensOutcomes,
      ...(delta.lensOutcomes ?? {})
    }
  };
}

export function transitionLens(
  input: UniverseState,
  toLensId: string,
  registry: LensMappingRegistry
): LensTransitionResult {
  const context = computeLensTransitionContext(input, toLensId);
  const decode = registry.decodeMap[context.fromLensId] ?? fallbackDecode;
  const encode = registry.encodeMap[context.toLensId] ?? fallbackEncode;

  const decoded = decode(input, context);
  const encodedDelta = encode(decoded, context);

  const deltaU: DeltaU = {
    ...encodedDelta,
    activeLensId: toLensId,
    anchors: context.anchors,
    lensOutcomes: {
      ...(encodedDelta.lensOutcomes ?? {}),
      [toLensId]: decoded.outcomes
    }
  };

  return {
    context,
    deltaU,
    nextU: applyDeltaU(input, deltaU)
  };
}
