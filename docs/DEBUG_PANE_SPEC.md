# Debug Pane Behavior and Limitations Spec

This document defines the current, implemented behavior of the in-game debug pane in `UiScene`.

## Scope

- Scene: `ui-scene` (`src/scenes/UiScene.ts`)
- Platform target: browser runtime (desktop + mobile web)
- Purpose: lightweight runtime log viewer + JavaScript command runner for development diagnostics

## Entry points and lifecycle

- The debug tools initialize from `UiScene.create()` via `initializeDebugTools()`.
- Initialization sets up:
  - visible debug toggle button
  - expandable debug pane
  - console/error capture hooks
  - hidden HTML input used for reliable text input on mobile/desktop
- If initialization fails, the scene logs an error, tears down debug UI artifacts, restores console handlers, and continues running without debug tooling.
- On scene shutdown, all debug input handlers and browser/global hooks are removed/restored.

## Toggle button and pane visibility

- A top-centered `Debug` button is always rendered in the UI layer.
- Tapping/clicking the button toggles pane state:
  - collapsed state label: `Debug`
  - expanded state label: `Close`
- Expand/collapse is animated (`180ms`, cubic out).
- Expanded pane target height: `max(180px, 72% of scene height)`.
- Collapsed pane height: `0` and pane container is hidden when tween completes.

## Input blocking behavior

- When pane is expanded, `UI_INPUT_BLOCKED_EVENT` is emitted with `true`.
- When pane is collapsed or scene shuts down, `UI_INPUT_BLOCKED_EVENT` is emitted with `false`.
- The pane includes an interaction shield that consumes pointer down/up/move events to prevent accidental passthrough to underlying gameplay UI.

## Layout and responsive behavior

- Pane is anchored at top of screen below the toggle button.
- Layout updates on:
  - Phaser scale resize events
  - `visualViewport` resize/scroll events (when available)
- The pane compensates for mobile virtual keyboard inset:
  - inset measured from `window.innerHeight - (visualViewport.height + visualViewport.offsetTop)`
  - inset only applied when >= `80px`
  - pane shifts upward while expanded to keep command input reachable
- On mobile, the log viewport remains scrollable while the pane is open, and scrolling logs is a first-class interaction (not blocked by keyboard-first behavior).

## Log capture behavior

- Console methods intercepted:
  - `log`, `info`, `warn`, `error`, `debug`
- Each captured call is appended as one line prefixed by method tag (for example `[warn] ...`).
- Original console behavior is preserved (logs still go to browser console).
- Global browser error capture:
  - `window.onerror` entries logged as `[exception] ...`
  - `window.onunhandledrejection` entries logged as `[promise] Unhandled rejection: ...`
- On startup, pane appends onboarding hints about command execution and available helpers.

## Log storage, rendering, and scrolling

- In-memory log ring limit: `120` lines (`MAX_LOG_LINES`).
- When capacity is exceeded, oldest lines are dropped.
- Visible lines are estimated from pane height with an assumed line height of `18px`.
- Log view supports:
  - wheel scrolling (desktop)
  - drag scrolling via a dedicated scroll hit area (touch + mouse)
- Auto-follow behavior:
  - enabled by default and follows newest logs
  - disabled when user scrolls up
  - re-enabled when scroll offset returns to bottom

## Command input behavior

- Visual command row includes:
  - text display area (inside Phaser scene)
  - `Run` button
- Actual text entry is handled by an overlaid hidden/fixed HTML `<input type="text">` for better browser IME/mobile keyboard behavior.
- Placeholder text when empty: `Type JavaScript and press Enter`.
- Commands execute on:
  - Enter key in hidden input
  - `Run` button press
- Empty commands are ignored with `[command] Empty command.` log.

## Command execution semantics

- User command is executed through `new Function(...)` with helper bindings:
  - `scene` (`UiScene` instance)
  - `game` (`Phaser.Game`)
  - `Phaser`
  - `consoleRef`
  - helper functions: `log`, `info`, `warn`, `error`, `debug`
- Execution strategy:
  1. attempt expression mode: `return (<command>)`
  2. on `SyntaxError`, retry as statement block
- Result logging:
  - sync result: `[result] ...`
  - promise result: logs pending + resolved/rejected outcome
  - thrown errors: logged as `[error] ...`
- After execution, input is cleared and focus is restored.

## Focus and scroll interaction safeguards

- A temporary focus-suppression window (`180ms`) prevents immediate refocus of the command input after wheel/drag interactions.
- During suppression:
  - pointer interaction with input is prevented
  - hidden input is blurred
- Keyboard visibility policy:
  - scrolling the debug pane (wheel/drag/touch scroll) must **not** trigger the on-screen keyboard on mobile
  - the keyboard is shown only when the user explicitly focuses/taps the text input region
- Goal: avoid accidental keyboard popups while user is scrolling logs, while preserving intentional text entry.

## Styling and visual treatment

- Pane uses dark translucent backdrop + animated tiled texture.
- Monospace typography throughout for logs and command input.
- Debug pane depth is above gameplay UI (`depth 1000+`), with button at `1001`.

## Limitations and non-goals

- **Not production-hardened security**: command runner executes arbitrary JavaScript in page context.
- **No command history**: previously run commands are not navigable or persisted.
- **No filtering/search**: logs are plain appended text, no categories/toggles.
- **No persistence**: logs reset on scene reload/shutdown.
- **Single-line input model**: no multiline editor UX.
- **Approximate text metrics**: visible line count and drag scroll are based on estimated line height, not exact rendered measurement.
- **Global hook ownership**: pane temporarily overrides `window.onerror` and `window.onunhandledrejection`, then restores known prior handlers on shutdown.
- **Browser-only capture**: console/error capture relies on `window` and does not target non-browser runtimes.

## Operational guidance

- Treat this pane as a developer diagnostic utility, not player-facing gameplay UI.
- Keep disabled from production builds unless explicitly required.
- If future hardening is needed, prioritize:
  1. command sandboxing/removal
  2. log filtering + export
  3. persistence and command history
  4. stricter integration contract for global error hooks
