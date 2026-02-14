import type { DeltaU, UniverseState } from '@adventure/core-schema';
import type { LensTransitionContext } from '@adventure/lens-runtime';

export interface TransitionVisualEvent {
  context: LensTransitionContext;
  current: UniverseState;
  deltaU: DeltaU;
  next: UniverseState;
}

type TransitionHandler = (event: TransitionVisualEvent) => void;

export interface TransitionHooks {
  onPreTransition(handler: TransitionHandler): () => void;
  onPostTransition(handler: TransitionHandler): () => void;
  emitPreTransition(event: TransitionVisualEvent): void;
  emitPostTransition(event: TransitionVisualEvent): void;
}

function addHandler(bucket: Set<TransitionHandler>, handler: TransitionHandler): () => void {
  bucket.add(handler);

  return () => {
    bucket.delete(handler);
  };
}

export function createTransitionHooks(): TransitionHooks {
  const preTransitionHandlers = new Set<TransitionHandler>();
  const postTransitionHandlers = new Set<TransitionHandler>();

  return {
    onPreTransition(handler) {
      return addHandler(preTransitionHandlers, handler);
    },
    onPostTransition(handler) {
      return addHandler(postTransitionHandlers, handler);
    },
    emitPreTransition(event) {
      preTransitionHandlers.forEach((handler) => handler(event));
    },
    emitPostTransition(event) {
      postTransitionHandlers.forEach((handler) => handler(event));
    }
  };
}
