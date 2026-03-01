import { type PromptScript } from './types';

export const defaultPromptScript: PromptScript = {
  startSceneId: 'intro',
  scenes: [
    {
      id: 'intro',
      speaker: 'Caretaker Mina',
      portrait: '🐹',
      expression: 'flat',
      pages: [
        {
          id: 'intro-1',
          text: 'He keeps rearranging his bedding into geometric rings. Nobody taught him that.',
          keywords: [
            {
              id: 'inspection',
              label: 'inspection',
              note: 'Weekly inspection records show repeated pattern changes around midnight.',
            },
          ],
        },
        {
          id: 'intro-2',
          text: 'The bowl smells like disinfectant and fennel. We should decide what to do before lights-out.',
          keywords: [
            {
              id: 'odor',
              label: 'odor',
              note: 'Unfamiliar odor appears after medication schedule updates.',
            },
          ],
        },
      ],
      choices: [
        { id: 'feed-now', text: 'Feed him now', tone: 'kind', style: 'literal', nextSceneId: 'fed' },
        {
          id: 'wait-observe',
          text: 'Wait and observe',
          tone: 'cautious',
          style: 'tonal',
          nextSceneId: 'observe',
          revealAfterMs: 800,
        },
        {
          id: 'clean-first',
          text: 'Clean the cage first',
          tone: 'practical',
          style: 'literal',
          nextSceneId: 'clean',
          revealAfterMs: 1200,
        },
        {
          id: 'record-incident',
          text: 'Record incident',
          tone: 'ominous',
          style: 'administrative',
          nextSceneId: 'incident',
          requiresKeywordIds: ['inspection'],
          holdToConfirmMs: 900,
        },
      ],
    },
    {
      id: 'fed',
      speaker: 'Caretaker Mina',
      portrait: '🐹',
      expression: 'hesitant',
      pages: [
        { id: 'fed-1', text: 'He takes one pellet, then stares past us at the door camera.' },
        { id: 'fed-2', text: 'That should have been comforting. It wasn’t.' },
      ],
      autoAdvanceToSceneId: 'intro',
    },
    {
      id: 'observe',
      speaker: 'Caretaker Mina',
      portrait: '🐹',
      expression: 'too cheerful',
      pages: [
        { id: 'observe-1', text: 'He drags the empty bowl into a perfect north-facing position and waits.' },
      ],
      autoAdvanceToSceneId: 'intro',
    },
    {
      id: 'clean',
      speaker: 'Caretaker Mina',
      portrait: '🐹',
      expression: 'practical',
      pages: [{ id: 'clean-1', text: 'Fresh bedding reveals scratches under the tray. They look alphabetical.' }],
      autoAdvanceToSceneId: 'intro',
    },
    {
      id: 'incident',
      speaker: 'System',
      portrait: '📋',
      expression: 'administrative',
      pages: [{ id: 'incident-1', text: 'Incident filed. Classification shifted to “anomalous companion behavior”.' }],
      autoAdvanceToSceneId: 'intro',
    },
  ],
};
