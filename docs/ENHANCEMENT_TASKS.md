# Enhancement Tasks from GDD Gap Review

This backlog translates **missing or incomplete items** from `docs/GDD_V1.md` into implementation-ready tasks.

## MVP-Critical Gaps (build next)

### 1) Add missing core player actions (water + handling + sweet feed)
**Gap:** GDD surface loop requires feeding, watering, cleaning, and handling/petting interactions. The UI currently exposes only feed + clean action buttons.

- [ ] Add UI buttons and bindings for:
  - refill water
  - handle hamster
  - sweet feed (separate from standard feed)
- [ ] Show basic cooldown/disabled state when inventory is empty.
- [ ] Add action SFX variants so these interactions feel distinct.

**Acceptance criteria**
- Player can trigger all three actions on desktop + touch.
- HUD/state values visibly respond to each action.

---

### 2) Expand dialogue content to MVP target (10–15 windows)
**Gap:** GDD MVP target is ~10–15 dialogue windows; current data set is smaller and mostly warning-only.

- [ ] Add tutorial/start-of-run dialogs (onboarding, first feed, first clean).
- [ ] Add at least 4 dark-comic flavor dialogs that can trigger without crisis states.
- [ ] Add one short multi-page branch that uses follow-up dialog IDs.
- [ ] Ensure each added dialog has effects or explicit no-op intent.

**Acceptance criteria**
- Dialogue JSON contains at least 10 valid entries.
- At least 1 chain uses `nextDialogId` or `followUpDialogIds`.

---

### 3) Implement peaceful old-age ending logic
**Gap:** MVP calls for 1–2 endings including peaceful old age + neglect death. Neglect/death path exists, but old-age win condition is not wired.

- [ ] Add age/day progression condition for peaceful ending.
- [ ] Gate ending behind minimum care quality (avoid immediate passive win).
- [ ] Add dedicated ending presentation copy and restart/return-to-title affordance.

**Acceptance criteria**
- A stable-care run can reach a non-death ending.
- Ending scene displays authored text for peaceful outcome.

---

### 4) Add happiness milestone unlocks for toys/decor progression
**Gap:** GDD progression expects unlocks tied to happiness + days survived; unlock lists are present in state but not driven by milestone rules.

- [ ] Define 3–5 progression milestones in data.
- [ ] Evaluate milestones during simulation ticks/day transitions.
- [ ] Surface unlock notifications via dialog modal.
- [ ] Add at least 1 toy item behavior hook to affect boredom/mood/stress.

**Acceptance criteria**
- New unlock IDs appear in `progression.unlockedItems` through play.
- Unlocks are communicated in-game when first obtained.

---

### 5) Add visible signs for dirty-cage consequences
**Gap:** GDD specifies visual cues (stains/flies/green tint) for prolonged neglect; simulation penalties exist, but stronger visual feedback is still missing.

- [ ] Add layered grime/flies overlays tied to cage cleanliness thresholds.
- [ ] Increase ambient tint shift as cleanliness worsens.
- [ ] Add a subtle “illness risk rising” cue before health collapse.

**Acceptance criteria**
- Players can infer dirty-state danger without reading debug/status numbers.

---

## Near-Term Enhancements (after MVP-critical)

### 6) Trait matrix expansion to full v1 set
- [ ] Extend traits beyond current subset to include smart/dim, vengeful/forgiving, diurnal/nocturnal.
- [ ] Apply trait modifiers to stat drift and interaction outcomes.
- [ ] Add trait-seeded behavior variation at run start.

### 7) Behavior utility pass (reduce purely stat-driven feel)
- [ ] Introduce simple utility/priority behavior state for hamster animation intent.
- [ ] Drive visible behavior states (idle/sleep/eat/play/hide/pacing) from utility outputs.
- [ ] Add at least one pathological loop behavior at extreme stress/grudge.

### 8) Journal / hamster file system
- [ ] Persist milestones, event sightings, and ending records in a journal view.
- [ ] Add title-screen access to review unlocked history.
- [ ] Include short flavor text entries for discovered anomalies.

### 9) UI skin pass for stronger Win98 authenticity
- [ ] Replace flat modals/buttons with beveled title-bar windows.
- [ ] Add iconography/pointer-state cues for interactive elements.
- [ ] Add optional CRT/scanline overlay toggle.

### 10) Inventory/item tuning pass
- [ ] Add explicit item properties (nutrition, spoil, palatability, stimulant, toxin risk).
- [ ] Add toy durability + risk metadata.
- [ ] Move action outcomes from hard-coded values toward item-driven data.

---

## Post-MVP / Advanced Systems

### 11) Save/reload meta-awareness events
- [ ] Track repeated quick reload behavior and save frequency patterns.
- [ ] Trigger meta-commentary dialog/event branches when thresholds are crossed.
- [ ] Keep tone unsettling but non-graphic per GDD boundaries.

### 12) Real-time catch-up simulation on return
- [ ] On load, optionally simulate elapsed real time with capped catch-up window.
- [ ] Produce summary dialog (“while you were gone”).
- [ ] Add settings toggle for players who prefer no offline progression.

### 13) Time-window anomalies (late-night / morning event bands)
- [ ] Tag events with optional time windows.
- [ ] Adjust ambient audio/visual mood by band.
- [ ] Add one late-night anomaly chain and one morning recovery chain.

### 14) Broader endings set
- [ ] Add escape ending.
- [ ] Add psychological break-style ending.
- [ ] Add ending unlock metadata for journal and replay goals.

---

## Suggested Delivery Order (2 sprints)

### Sprint 1 (stabilize MVP promise)
1. Core missing actions (Task 1)
2. Dialogue count/content expansion (Task 2)
3. Peaceful old-age ending (Task 3)
4. Dirty-cage visual readability (Task 5)

### Sprint 2 (progression + retention)
1. Happiness milestone unlocks (Task 4)
2. Trait matrix expansion (Task 6)
3. Journal/hamster file (Task 8)
4. Inventory/item tuning pass (Task 10)

---

## Notes for implementation hygiene

- Prefer data-driven additions (`dialogs.json`, `events.json`, item datasets) over hard-coded scene logic where possible.
- For each shipped task, record:
  1. Which GDD pillar it supports.
  2. Which hidden stats/flags it changes.
  3. Which events/dialog IDs it can trigger.
  4. Whether scope is MVP or post-MVP.
