# Hamster Keeper '98 (TypeScript Skeleton)

A TypeScript + Phaser 3 starter scaffold for the hamster care simulation described in the GDD.

## Scripts

- `npm install`
- `npm run dev`
- `npm run check`
- `npm run build`

## Current scope

- Phaser scenes: Boot, Title, Cage, UI, Ending.
- Type-safe simulation state model.
- MVP simulation tick with sample hidden-rule behaviors.
- JSON-backed event + dialog definitions.


## CI and GitHub Pages

- `CI` workflow runs type-check + production build on pull requests and pushes to `main`.
- `Deploy to GitHub Pages` workflow builds and publishes `dist/` on pushes to `main`.
- Vite uses a relative `base` (`./`) so the game works when served from a repository subpath on Pages.
