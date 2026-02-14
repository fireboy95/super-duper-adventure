import React from 'react';
import { createRoot } from 'react-dom/client';
import { parseUniverseState, zUEntityState } from '@adventure/core-schema';
import { transitionLens, type LensMappingRegistry } from '@adventure/lens-runtime';
import { createTransitionHooks } from './transitionHooks.js';

const transitionHooks = createTransitionHooks();

const clientRegistry: LensMappingRegistry = {
  decodeMap: {},
  encodeMap: {
    'lens/exploration': (decoded, context) => ({
      activeLensId: context.toLensId,
      lensStates: {
        [context.toLensId]: {
          ...((decoded.state as Record<string, unknown>) ?? {}),
          cameraHint: 'ease-in'
        }
      }
    })
  }
};

export function AppShell(): JSX.Element {
  const schemaShape = Object.keys(zUEntityState.shape).join(', ');
  const [transitionStatus, setTransitionStatus] = React.useState('idle');

  React.useEffect(() => {
    const unsubscribePre = transitionHooks.onPreTransition(({ context }) => {
      setTransitionStatus(`pre-transition: ${context.fromLensId} -> ${context.toLensId}`);
    });

    const unsubscribePost = transitionHooks.onPostTransition(({ context }) => {
      setTransitionStatus(`post-transition: ${context.fromLensId} -> ${context.toLensId}`);
    });

    return () => {
      unsubscribePre();
      unsubscribePost();
    };
  }, []);

  function runClientTransition(): void {
    const currentU = parseUniverseState({
      tick: 7,
      activeLensId: 'lens/hub',
      frame: { tick: 7, entities: [] },
      anchors: {
        hp: 89,
        inventory: ['torch', 'potion'],
        relics: ['sun-stone'],
        flags: { cutsceneSeen: true }
      },
      lensStates: {
        'lens/hub': { cameraHint: 'locked' }
      },
      lensOutcomes: {
        'lens/hub': { objective: 'exit-town' }
      }
    });

    const transitioned = transitionLens(currentU, 'lens/exploration', clientRegistry);
    transitionHooks.emitPreTransition({
      context: transitioned.context,
      current: currentU,
      deltaU: transitioned.deltaU,
      next: transitioned.nextU
    });
    transitionHooks.emitPostTransition({
      context: transitioned.context,
      current: currentU,
      deltaU: transitioned.deltaU,
      next: transitioned.nextU
    });
  }

  return (
    <main>
      <h1>Super Duper Adventure</h1>
      <p>Lens host UI shell is live.</p>
      <p>Entity schema keys: {schemaShape}</p>
      <button type="button" onClick={runClientTransition}>
        Simulate Lens Transition
      </button>
      <p>Transition hook status: {transitionStatus}</p>
    </main>
  );
}

export function mountApp(element: HTMLElement): void {
  const root = createRoot(element);
  root.render(<AppShell />);
}
