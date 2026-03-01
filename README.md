# Phaser 2D Starter

A clean starter repository for building a 2D game with Phaser 3, powered by Vite + TypeScript.

## Quick start

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Scripts

- `npm run dev` — Start local development server.
- `npm run check` — Run TypeScript type checks.
- `npm run build` — Build production files into `dist/`.

## GitHub Pages deployment

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that:

1. hydrates Git LFS-backed files in `public/assets/` so CI builds always package real asset contents,
1. installs dependencies,
2. builds the project, and
3. deploys `dist/` to GitHub Pages.

The Vite config uses the GitHub Actions-provided repository name when available, so Pages URLs resolve correctly for project sites.

## Codex-oriented architecture docs

- See `docs/CODEX_GAME_BUILD_GUIDE.md` for implementation rules, migration playbook, and project structure optimized for AI-assisted development.
- See `docs/PHASER_MOBILE_WEB_BEST_PRACTICES.md` for a mobile-first Phaser web game best-practices guide.
