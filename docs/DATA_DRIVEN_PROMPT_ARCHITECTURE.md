# Data-Driven Prompt Architecture for Super Duper Adventure

This document defines the production pattern for robust, configurable prompts in the game.

## Goals

- Keep dialogue content data-driven and editable without changing scene code.
- Preserve old-school step-through dialogue while supporting deeper systems.
- Make prompt logic deterministic, serializable, and testable outside Phaser.
- Support mobile-friendly UX patterns (tap flow, stacked choices, log/notebook, decision pauses).

## Architecture

## 1) Content schema layer

Prompt content lives in typed script objects (or JSON loaded into those types).

Core entities:

- `PromptScript`
- `PromptSceneNode`
- `PromptPage`
- `PromptChoice`
- `PromptKeyword`

Key capabilities:

- Multi-page dialogue chunks
- 2–4 visible choices at once
- Delayed choice reveal (`revealAfterMs`)
- Keyword-gated choices (`requiresKeywordIds`)
- High-stakes metadata (`holdToConfirmMs`)

See implementation types in `src/game/prompt/types.ts`.

## 2) Runtime engine layer

`PromptEngine` owns progression and state transitions.

Responsibilities:

- Entering scenes and advancing pages
- Resolving which choices are currently visible
- Tracking unlocked keywords, dialogue log, and notebook entries
- Returning an immutable `PromptSnapshot` for the UI

The runtime does not use Phaser APIs and can be unit-tested as pure TypeScript.

See implementation in `src/game/prompt/PromptEngine.ts`.

## 3) Phaser adapter/UI layer

`MainScene` reads snapshots from `PromptEngine` and renders:

- Bottom-anchored dialogue panel
- Portrait + speaker/expression
- Tap-to-continue affordance
- Stacked full-width choice cards
- Decision pause dimmer during choice state
- Dialogue log and notebook utility panels
- Keyword chip interactions

See integration in `src/scenes/MainScene.ts`.

## Prompt lifecycle

1. Create `PromptEngine` with script.
2. Call `begin(nowMs)`.
3. On tap, call `advance(nowMs)` when no choices are visible.
4. On keyword tap, call `inspectKeyword(keywordId)`.
5. On choice, call `selectChoice(choiceId, nowMs)`.
6. Render each frame/state-change from `getSnapshot(nowMs)`.

## Content authoring guidelines

- Keep pages concise (1–3 sentences).
- Use strong speaker identity and expression labels.
- Use tone labels in choices for emotional legibility.
- Prefer additive reveal (delayed or gated options) for depth.
- Use hold-to-confirm metadata only for rare high-stakes choices.

## Save/load integration notes

Persist these runtime fields:

- `currentSceneId`
- `currentPageIndex`
- `sceneEnteredAtMs` (or elapsed scene time)
- `unlockedKeywordIds`
- `dialogueLog`
- `notebookEntries`

This enables exact restoration after app background/interrupt events.

## Extensibility roadmap

- Swap script source to JSON from CDN/local packs.
- Add localization key indirection for text bodies.
- Add voice/audio cue metadata per page.
- Add relationship/mood influence tags and hidden counters.
- Add deterministic replay logs for QA and narrative debugging.
