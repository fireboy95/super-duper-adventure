# Codex Build Guide: Phaser 2D Game (TypeScript + ES Modules)

This document is optimized for AI-assisted implementation (Codex).  
Treat it as the **source of truth** for repository structure, architecture rules, and migration strategy.

---

## 1) Primary assumptions

- **Engine**: Phaser 3 (preferred mainstream track).
- **Language/runtime**: TypeScript + ES modules.
- **Build tooling**: Vite.
- **Targets**: Modern desktop and mobile browsers.

If legacy code exists (Phaser 2/CE + AMD), use the migration plan in §8.

---

## 2) Non-negotiable architecture rules

1. **Scenes orchestrate; systems implement logic.**
   - Scene files should coordinate flow and lifecycle.
   - Game rules should live in domain/system modules (minimal Phaser coupling).
2. **Use Scene Plugin APIs (`this.scene`) from inside scenes.**
   - Do not directly manipulate Scene Manager internals.
3. **Prefer pure domain state for core game logic.**
   - Keep simulation state serializable and testable outside Phaser.
4. **Keep Phaser-specific code in adapters.**
   - Input, audio, persistence, and rendering bridges should be isolated.
5. **Design for performance from day one.**
   - Avoid hot-loop allocations.
   - Use pooling for frequently created objects.
   - Profile against 16.6ms/frame budget (60 FPS).

---

## 3) Repository structure Codex should generate/use

```text
.
├─ public/
│  ├─ assets/
│  │  ├─ atlases/
│  │  ├─ audio/
│  │  ├─ fonts/
│  │  └─ images/
│  └─ style.css
├─ src/
│  ├─ main.ts
│  ├─ game/
│  │  ├─ main.ts
│  │  ├─ config/
│  │  │  ├─ gameConfig.ts
│  │  │  └─ version.ts
│  │  ├─ scenes/
│  │  │  ├─ BootScene.ts
│  │  │  ├─ PreloadScene.ts
│  │  │  ├─ MainMenuScene.ts
│  │  │  ├─ GameScene.ts
│  │  │  └─ UIScene.ts
│  │  ├─ systems/
│  │  │  ├─ InputSystem.ts
│  │  │  ├─ AudioSystem.ts
│  │  │  ├─ PhysicsSystem.ts
│  │  │  ├─ AnimationSystem.ts
│  │  │  └─ SaveSystem.ts
│  │  ├─ ecs/
│  │  │  ├─ Entity.ts
│  │  │  ├─ Components.ts
│  │  │  ├─ World.ts
│  │  │  └─ systems/
│  │  ├─ services/
│  │  │  ├─ EventBus.ts
│  │  │  ├─ AssetRegistry.ts
│  │  │  └─ Logger.ts
│  │  ├─ ui/
│  │  │  ├─ Hud.ts
│  │  │  └─ Menus.ts
│  │  └─ debug/
│  │     ├─ DebugOverlay.ts
│  │     └─ PerfCounters.ts
│  └─ shared/
│     ├─ math/
│     ├─ rng/
│     └─ time/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
└─ docs/
```

---

## 4) Bootstrapping contract

### `src/main.ts`

```ts
import { startGame } from "./game/main";

startGame();
```

### `src/game/main.ts`

```ts
import Phaser from "phaser";
import { makeGameConfig } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";

export function startGame() {
  const config: Phaser.Types.Core.GameConfig = makeGameConfig([
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameScene,
    UIScene
  ]);

  // eslint-disable-next-line no-new
  new Phaser.Game(config);
}
```

---

## 5) Scene flow and lifecycle

Expected flow:

1. `BootScene`
2. `PreloadScene`
3. `MainMenuScene`
4. `GameScene`
5. Optional overlays (e.g., `UIScene`, pause)

Guidelines:

- Do asset loading in `preload()`.
- Instantiate game objects and systems in `create()`.
- Execute simulation/update orchestration in `update()`.
- Unsubscribe listeners/timers in `shutdown` and `destroy` lifecycle cleanup.

---

## 6) State, ECS, and system boundaries

### State model

- Define a pure `GameState` domain model.
- Keep it serializable (save/load friendly).
- Sync Phaser objects from state through adapter/system layers.

### ECS recommendation

- Entity = numeric id.
- Components = data-only stores (maps or dense arrays).
- Systems = pure transforms where possible.
- Run systems in a deterministic order.

### Minimal ECS sample

```ts
export type EntityId = number;

export interface Position { x: number; y: number; }
export interface Velocity { vx: number; vy: number; }

export class World {
  private nextId = 1;
  readonly position = new Map<EntityId, Position>();
  readonly velocity = new Map<EntityId, Velocity>();

  createEntity(): EntityId {
    return this.nextId++;
  }

  destroyEntity(id: EntityId) {
    this.position.delete(id);
    this.velocity.delete(id);
  }
}
```

---

## 7) TypeScript + Vite configuration baseline

Use this as baseline:

```jsonc
{
  "compilerOptions": {
    "noEmit": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "useDefineForClassFields": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": {
      "@game/*": ["src/game/*"],
      "@shared/*": ["src/shared/*"]
    },
    "sourceMap": true
  },
  "include": ["src", "tests"]
}
```

Notes:

- `moduleResolution: "Bundler"` is ideal for bundler workflows.
- If running emitted JS in Node ESM environments, validate extension handling explicitly.

---

## 8) AMD → ESM migration plan (for legacy projects)

### Stage 1: Syntax migration (keep old runtime)

- Convert TS code to `import` / `export`.
- Keep temporary AMD output if required for compatibility.
- Establish a single root entrypoint (`src/game/main.ts`).

### Stage 2: Parallel modern lane

- Add Vite build/dev setup in parallel.
- Mirror structure from §3.
- Validate gameplay parity old vs new lane.

### Stage 3: Runtime switch

- Move fully to ESM output.
- Remove RequireJS bootstrapping and AMD wrappers.
- Replace AMD dynamic patterns with static imports and `import()` lazy loading.

### Stage 4: Hardening

- CI checks: no AMD artifacts, no RequireJS references.
- Validate static-hosted paths, cache headers, and deploy base URL.

---

## 9) Asset loading conventions

- Default path strategy: `public/assets/*` loaded at runtime.
- Optional strategy: bundler-imported assets for code-referenced resources.
- Use atlases/spritesheets for render efficiency.
- Prefer pack manifests for grouped loading where practical.

Example:

```ts
this.load.pack("base", "assets/pack.json");
```

---

## 10) Input, audio, physics guidelines

### Input

- Use Phaser Input Plugin (`this.input`) in scene boundaries.
- Support touch + mouse through unified pointer events.
- Add extra pointers explicitly for multitouch-heavy gameplay.

### Audio

- Implement explicit user-gesture unlock flow ("Tap to start").
- Keep audio API wrapped in an `AudioSystem` for testability.

### Physics

- Use Arcade for lightweight/high-performance collision logic.
- Use Matter when advanced rigid-body features are required.
- Do not mix assumptions between Arcade and Matter bodies.

---

## 11) Performance checklist (must-pass before release)

- [ ] Profile FPS and frame-time on representative low-end mobile.
- [ ] Keep hot update loops allocation-light.
- [ ] Object-pool projectiles/particles/frequent transient entities.
- [ ] Minimize texture swaps; prefer atlas batching.
- [ ] Disable physics/debug rendering in production.
- [ ] Compress and size-tier assets (mobile-first budgets).

---

## 12) Testing strategy

Layered test approach:

1. **Unit tests**: pure logic (math, combat rules, ECS systems, serialization).
2. **Integration tests**: adapters + selected systems.
3. **E2E tests**: real browser flows (boot, menu, gameplay loop, pause/resume).

Testing principle:

- Mock your **own interfaces** (input/audio/save), not Phaser internals.

---

## 13) CI/CD and deployment defaults

- Build with `vite build`.
- Deploy static `dist/` output (e.g., GitHub Pages or any static host).
- If PWA enabled:
  - include manifest,
  - include service worker strategy,
  - define update policy (auto-update vs prompt).

---

## 14) Codex execution checklist (when implementing features)

For every feature PR, Codex should:

1. Add/adjust scene wiring only where needed.
2. Implement core logic in systems/domain modules.
3. Keep Phaser API interactions in adapters/scenes.
4. Add or update unit tests for pure logic.
5. Run type check + build.
6. Verify no debug-only code ships to production paths.
7. Document any performance implications.

---

## 15) Quick “do/don’t” rules

### Do

- Use class-based Phaser 3 scenes.
- Keep scene and asset keys centralized constants.
- Use `this.scene` for transitions/orchestration.
- Keep code split-friendly with dynamic `import()` for large optional content.

### Don’t

- Don’t put core game rules directly in giant scene classes.
- Don’t allocate new arrays/objects in tight loops unless required.
- Don’t ship with physics debug overlays enabled.
- Don’t assume desktop-only input/audio behavior works unchanged on mobile.

---

## 16) Definition of done for this architecture

A change is “done” when:

- Project builds and type-checks cleanly.
- Scene flow remains valid.
- Domain logic is test-covered.
- Performance remains within budget on target devices.
- Asset loading works under deployed base path.
- No legacy AMD runtime dependencies remain (if on ESM track).

## 17) Data-driven prompt architecture (dialogue-first games)

For story-heavy mobile games, treat dialogue prompts as structured content, not hard-coded scene strings.

### Required prompt system layers

- **Prompt content schema**: `PromptScript`, `PromptSceneNode`, `PromptPage`, `PromptChoice`, and optional keyword metadata.
- **Prompt runtime/engine**: pure TypeScript class that resolves page progression, delayed choice reveals, conditional unlocks, and logs.
- **Phaser UI adapter**: scene/UI code that renders snapshots from the runtime and sends interaction intents back (`advance`, `selectChoice`, `inspectKeyword`).

### Design constraints

- Prompt logic must be serializable and testable without Phaser.
- Content should support **delayed choices**, **keyword-gated choices**, and **high-stakes confirmation metadata** (for hold-to-confirm or explicit confirm dialog).
- UI should consume a `PromptSnapshot` to avoid scattering game-state knowledge across components.

### Recommended content shape

```ts
type PromptScript = {
  startSceneId: string;
  scenes: PromptSceneNode[];
};

type PromptSceneNode = {
  id: string;
  speaker: string;
  portrait: string;
  expression: string;
  pages: PromptPage[];
  choices?: PromptChoice[];
  autoAdvanceToSceneId?: string;
};
```

### Prompt implementation checklist

- Keep each page to 1–3 sentences for tap-through readability.
- Enforce 2–4 visible choices for mobile ergonomics.
- Provide tone/style metadata for choices (`kind`, `cautious`, `ominous`, etc.).
- Keep a rolling dialogue log and notebook entries for interruption recovery.
- Route high-stakes choices through confirm or hold-to-confirm affordances.

---
