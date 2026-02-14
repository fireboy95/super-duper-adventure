import React from 'react';
import { createRoot } from 'react-dom/client';
import { zUEntityState } from '@adventure/core-schema';

export function AppShell(): JSX.Element {
  const schemaShape = Object.keys(zUEntityState.shape).join(', ');

  return (
    <main>
      <h1>Super Duper Adventure</h1>
      <p>Lens host UI shell is live.</p>
      <p>Entity schema keys: {schemaShape}</p>
    </main>
  );
}

export function mountApp(element: HTMLElement): void {
  const root = createRoot(element);
  root.render(<AppShell />);
}
