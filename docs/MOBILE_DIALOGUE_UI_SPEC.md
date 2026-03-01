# Mobile Dialogue UI/UX Spec (Dialogue-Driven 2D Game)

This spec translates the product direction into implementable UI behavior for mobile-first dialogue play.

## Core layout

- **Top region**: scene/room/character presentation.
- **Bottom third**: anchored dialogue panel.
- **Input model**: one primary interaction per state (read, advance, choose, or inspect).

## Required UI components

## 1) Bottom-anchored dialogue panel

- Occupies lower third.
- Large, high-contrast text and generous padding.
- One active speaker at a time.
- Tap-to-advance allowed when no explicit choices are on screen.

## 2) Character portrait + expression strip

- Compact portrait near speaker name.
- Expression/mood text tag for legibility (`flat`, `hesitant`, `too cheerful`).
- Prioritize expression swaps over heavy animation.

## 3) Tap-to-continue affordance

Always show a visible cue when tapping can advance:

- Blinking arrow, icon, or “Tap to continue”.

Never rely on implicit guesswork.

## 4) Choice presentation as stacked cards

- 2–4 full-width cards max.
- Vertical stack only (no side-by-side mobile splits).
- Large touch targets with spacing.
- Optional tone tinting for emotional reading.

## 5) Inline tone cues

Choice labels should support secondary tone hints:

- `Feed him now — kind`
- `Wait and observe — cautious`
- `Record incident — ominous`

## 6) Decision pause state

When choices appear:

- Dim background.
- Pause non-critical idle interactions.
- Visually separate decision moment from ambient flow.

## 7) Progressive reveal pacing

- Dialogue displayed in short chunks (1–3 sentences).
- Player taps to progress.
- Optional fast-forward can be added later.

## 8) Dialogue log and recap

- Persistent, easy-to-open log panel with recent lines.
- Prevents frustration from accidental rapid taps or interruptions.

## 9) Notebook/diary panel

Show evolving discovered context:

- observations
- suspicious patterns
- selected choices
- unlocked notes/theories

## 10) Delayed choice unlocks

Support staged choices by timing or discovery:

- timed reveal (`revealAfterMs`)
- keyword-gated reveal (`requiresKeywordIds`)

## 11) High-stakes confirmation pattern

For severe consequences, support:

- hold-to-confirm (`holdToConfirmMs`) or
- explicit confirm modal

Use sparingly.

## 12) Highlighted keyword interactions

Words/concepts should be inspectable through tappable chips or inline highlights.

On inspect:

- add note to notebook
- unlock additional content/choices

## Mobile ergonomics requirements

- Respect thumb zones: keep primary controls in lower-middle/lower-side region.
- Large targets (>= 44–48 CSS px equivalent).
- Avoid top-corner critical actions.
- Avoid hidden gestures for core narrative progression.
- Avoid dense paragraph walls and tiny pixel-font body text.

## Choice style families

- **Literal**: straightforward care actions.
- **Tonal**: relational/emotional responses.
- **Administrative ominous**: dry procedural dark-humor language.

## Current implementation mapping

Prototype implementation is wired in:

- `src/scenes/MainScene.ts`
- `src/game/prompt/PromptEngine.ts`
- `src/game/prompt/defaultPromptScript.ts`

This includes bottom dialogue, stacked choices, tone tags, decision dimmer, keyword taps, dialogue log, notebook panel, delayed unlocks, and high-stakes metadata.
