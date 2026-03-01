# Game Design Document
**Working Title:** Hamster Keeper ’98 (placeholder)  
**Platform:** Browser (desktop + mobile), responsive  
**Engine/Framework:** Phaser 3 (HTML5 canvas, JavaScript)

---

## 1. High-Level Concept

### Elevator pitch
A retro-styled 2D virtual pet game about feeding and caring for a hamster in a small cage. On the surface, it looks and plays like a simple, wholesome late-90s PC game, but underneath is a deep system of rules, hidden stats, and cascading consequences. Over time, darkly comic and unsettling behaviors emerge, creating humor from the contrast between cute visuals and grim subtext.

### Core pillars
1. **Deceptively simple:** Easy, obvious interactions (feed, clean, play) in a single small scene.
2. **Rich hidden simulation:** Complex internal stats and rule interactions drive unexpected outcomes.
3. **Dark humor through contrast:** Innocent pixel visuals + understated, often unsettling text/dialogue.
4. **1998 authenticity:** Visuals, audio, and UI evoke late-90s PC shareware / Win98 era.
5. **Browser-native and responsive:** Runs in modern browsers on desktop and mobile with a consistent “virtual resolution” and scaling.

---

## 2. Aesthetic & Presentation

### 2.1 Visual Style
- **Era:** 1998 PC game / shareware aesthetic.
- **Resolution target (virtual):** 640×480 primary (4:3 CRT feel), or 800×600 if space is needed.
- **Art style:** Pixel art or low-res sprites, dithered gradients, limited palette (VGA/SVGA feel), simple frame animations.
- **UI:** Chunky buttons, beveled borders, Win98-like dialog windows with title bars and close buttons, contextual pointer changes.

### 2.2 Audio
- **Music:** Looping MIDI-like tracks; mostly light and cheerful.
- **Mood shift:** Subtle detuning/minor overlays during darker states.
- **SFX:** UI clicks/beeps, hamster squeaks, bedding rustle, water bottle sounds.
- **Escalation cues:** Low hums or reversed-reverb accents when hidden systems intensify.

---

## 3. Platform & Technology

### 3.1 Stack
- **Framework:** Phaser 3.
- **Language:** JavaScript (ES6+) or TypeScript.
- **Rendering:** HTML5 Canvas via Phaser.
- **Hosting:** Static host compatible (GitHub Pages, Netlify, etc.).

### 3.2 Responsive Behavior
- Use a fixed virtual resolution for game logic/layout (default 640×480).
- Scale with Phaser Scale Manager using `FIT` and `CENTER_BOTH`.
- Handle mouse + touch through pointer events (single interaction abstraction).
- Prefer landscape on mobile; show rotate/letterbox hint for narrow portrait cases.

```js
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 480
  },
  pixelArt: true,
  scene: [BootScene, CageScene, UIScene, TitleScene]
};

const game = new Phaser.Game(config);
```

### 3.3 Retro Rendering
- Enable `pixelArt: true` to preserve crisp scaling.
- Ensure canvas image smoothing is disabled.
- Optional CRT/scanline overlay sprite for period styling.

---

## 4. Core Gameplay & Loop

### 4.1 Surface gameplay (player-visible)
1. Observe hamster behavior in-cage (idle/sleep/eat/run/play).
2. Interact by feeding, watering, cleaning, adjusting toys/decor, and petting/handling.
3. Respond to occasional popup prompts with simple choices.
4. Track visible high-level stats (Hunger, Mood, Cleanliness) and animation cues.
5. Repeat while discovering odd outcomes and deeper systems.

### 4.2 Player goals
- **Surface:** Keep hamster alive, maintain mood, unlock toys/decor via happiness milestones.
- **Hidden/meta:** Discover rare events and endings; test “what-if” scenarios for emergent outcomes.

---

## 5. Hidden Simulation & Systems

### 5.1 Hidden hamster stats
- **Basic needs:** Hunger, Thirst, Energy, Cleanliness (body), Health.
- **Mental state:** Stress, Boredom, Anxiety, Trust, Curiosity, Aggression, Obsession.
- **Traits (generated):** Timid↔Bold, Gluttonous↔Finicky, Neurotic↔Chill, Smart↔Dim, Vengeful↔Forgiving, Diurnal↔Nocturnal.
- Traits modify stat drift and reaction intensity.

### 5.2 Environment and items
- **Cage environment:** Cleanliness, temperature range, noise level, light level/day-night tie-in.
- **Food item properties:** Nutrition, spoil rate, palatability, stimulant effect, toxin risk.
- **Toy/decor properties:** Stimulation type, durability, risk factor.

### 5.3 Behavior AI
Implement via behavior tree or weighted utility system.
Priority examples:
1. Survival (eat/drink/sleep).
2. Relief (groom/hide under stress/noise).
3. Exploration/play.
4. Emergent/pathological loops under extremes (pacing, hoarding, repetitive actions).

### 5.4 Memory and grudges
Track interaction history (gentle handling vs rough actions, neglect, fear events).
- Negative history builds grudge: bite chance up, avoidance behavior.
- Positive history builds trust: approach cursor, calmer behavior near player.

---

## 6. Cause-and-Effect Rule Examples

### 6.1 Overfeeding sweets
- **Short term:** Hunger down, mood up, hyperactivity.
- **Medium term:** Stress and sleep disruption increase.
- **Long term:** Health decline and crisis event probability rises.

### 6.2 Neglecting cleanliness
- Dirty cage causes health penalties and stress increase.
- Visual hints: stained bedding, flies, green tint.
- Prolonged neglect can trigger illness-like events and lethargic/scratchy behavior.

### 6.3 Excessive handling
- Timid hamsters: trust down, stress up, more hiding.
- Bold/aggressive hamsters: bite chance up, visible flinch/anger states.

### 6.4 Ignoring warnings
System message tone escalates from helpful to unsettling if repeatedly ignored.

---

## 7. Time, Progression & Endings

### 7.1 Time
- In-game day/night cycle with visual lighting changes.
- Optional real-time catch-up simulation when returning.
- Time-gated event windows (late-night anomalies, morning notifications).

### 7.2 Progression
- Unlock foods/toys/decor via days survived and visible happiness milestones.
- Maintain a journal/log (“hamster file”) for endings/events/milestones.

### 7.3 End states
- Peaceful old age.
- Neglect/illness death.
- Escape.
- Psychological break-style outcomes.
- Meta-ending reacting to repeated save/reload behavior.

Tone remains suggestive and non-graphic.

---

## 8. Dialogue & Text System

### 8.1 Presentation
- Win98-style modal windows over gameplay.
- Components: title bar, 2–6 lines body text, 1–3 choice buttons.
- Supports single-page and multi-page dialogues.

### 8.2 Voices
1. **System/Tutorial** (neutral → passive aggressive when ignored).
2. **Hamster inner voice** (unlocks with conditions; uncanny/comic).
3. **Unreliable guide/manual** (outdated or wrong advice).
4. **External actors** (vet/neighbor/forum perspective).

### 8.3 Choice and consequence
Choices affect hidden stats, event flags, and long-term behavioral shifts.

---

## 9. Dark Humor & Tone Boundaries

### 9.1 Tone philosophy
- Cute and approachable on the surface.
- Subtext carries morally ambiguous and unsettling implications.
- No gore or explicit violence.

### 9.2 Situational humor examples
- Over-optimization causing hamster listlessness/existential text.
- Neglect reframed as adaptation by hamster narration.
- Save-scumming acknowledged by meta commentary.

---

## 10. UI & Interaction Design

### 10.1 Scene layout
- **CageScene:** Main cage plus room backdrop and clickable elements.
- **UIScene:** HUD/meters/inventory icons/dialog overlays.
- Dialog windows should always layer above active gameplay.

### 10.2 Input model
- Single pointer abstraction for touch + mouse.
- Click/tap for direct actions; drag for item placement/use.
- Large finger-friendly controls.

---

## 11. Technical Structure

### 11.1 Scene architecture
1. **BootScene:** preload assets/data and initialize global state.
2. **TitleScene:** start/options flow.
3. **CageScene:** simulation + rendering.
4. **UIScene:** HUD/dialogue and action routing.
5. **EndingScene(s):** ending-specific presentation.

### 11.2 Core systems
- **SimulationManager:** state, tick updates, action application, visible stat projection.
- **DialogueSystem:** JSON-defined dialogue scripts, condition checks, choice effects.
- **EventSystem:** trigger conditions, rarity/priority, dialogue hooks.
- **SaveSystem (MVP+):** localStorage persistence for simulation and event history.

---

## 12. MVP Scope (Initial Playable)

### Include
- 1 personality template with 2–3 traits.
- Core stats: Hunger, Thirst, Energy, Health, Cleanliness, Mood.
- Minimal items: 2 food types, 1 toy, basic bedding.
- Core rule examples implemented:
  - Sweets → short-term boost + long-term risk.
  - Dirtiness → illness probability.
  - Excess handling → trait-dependent stress response.
- Basic visual day/night cycle.
- ~10–15 dialog windows (tutorial + darkly comic event seeds).
- 1–2 endings: peaceful old age + simple neglect death.

### Deferred
Expanded trait matrix, richer item/risk catalogue, advanced illnesses, broader ending set, and full save/reload meta systems.

---

## 13. AI Development Notes (How to Use This Doc)

Use this GDD as the source of truth for implementation decisions and future planning:
- Prefer small visible UI with deep hidden simulation.
- Preserve cute/retro presentation while allowing darkly comic text escalation.
- Add content through data-driven JSON where possible (dialogs, events, items, traits).
- Protect tone boundaries: unsettling but non-graphic.
- Expand content iteratively from MVP while keeping behavior interactions testable.

When adding features, document:
1. Which pillar the feature supports.
2. Which hidden stats/flags it touches.
3. Which events/dialog lines it can trigger.
4. Whether it belongs in MVP or post-MVP scope.
