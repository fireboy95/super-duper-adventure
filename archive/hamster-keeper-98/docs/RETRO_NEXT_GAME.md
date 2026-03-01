# Hamster Keeper '98 Retrospective and Next-Game Plan

## Why this retro exists

The current game prototype helped us validate the tech stack and basic game loop, but the experience is not yet fun enough to ship confidently. This retro captures what went wrong, what worked, and how we should build the next game with stronger player outcomes.

## 1) What went wrong (and likely player pain)

### Product and design
- **Weak core fun loop**: actions exist, but there is not enough short-term payoff and long-term strategy tension.
- **Unclear player goals**: players cannot easily understand what "good play" looks like from moment to moment.
- **Low emotional cadence**: not enough spikes (surprise, delight, drama) between routine maintenance actions.
- **Limited choice quality**: decisions are often obvious or low-stakes instead of meaningful tradeoffs.

### Systems and content
- **Content thinness**: too few events/dialogs/states means sessions can feel repetitive quickly.
- **Balancing late in process**: tuning appears to be reactive rather than driven by clear target metrics.
- **Rules are hidden without sufficient feedback**: hidden systems can feel unfair when players cannot infer cause and effect.

### Production process
- **Prototype-first, fun-test-later**: we built structure before proving a compelling paper prototype.
- **No explicit "fun KPIs"**: we lack measurable targets for retention, session arc quality, and perceived agency.
- **Insufficient playtest cadence**: feedback likely came too late and from too few players.

## 2) What worked (keep these)

- **Strong technical foundation**: TypeScript + Phaser scene architecture is clear and extensible.
- **Data-driven direction**: JSON-backed content/events gives us a scalable path for iteration.
- **Documented design intent**: existing GDD and enhancement docs provide a useful baseline.

## 3) Root causes

1. We optimized for *building the game* before validating *the fun*.
2. We treated balancing as polish, not a first-class design activity.
3. We underinvested in player-facing feedback and onboarding clarity.
4. We lacked a strict milestone gate that blocks progress when playtests fail.

## 4) Next-game development framework

## Phase A — Concept validation (1 week)

### Deliverables
- 1-page experience brief: fantasy, player fantasy verbs, target audience, session length.
- Core loop sketch: 30-second, 5-minute, and 20-minute loops.
- 3 differentiators vs comparable games.

### Exit criteria (must pass)
- Team can explain the game in one sentence and one gif-worthy moment.
- At least 5 external people react positively to the concept pitch.

## Phase B — Graybox fun prototype (2 weeks)

### Deliverables
- Minimal playable with placeholder art/audio.
- One complete loop with at least 3 meaningful decisions.
- Immediate feedback for every action (visual + audio + numeric/system response).

### Exit criteria (must pass)
- 8+ playtesters can explain goals without coaching after 3 minutes.
- 70%+ report at least one "that was satisfying" moment.
- Median session length reaches target range for prototype (e.g., 8–12 minutes).

## Phase C — Vertical slice (2–3 weeks)

### Deliverables
- One polished slice that represents final quality for UX and mood.
- 3x content density of graybox loop (events, outcomes, dialogue).
- Basic progression arc (early-mid-late tension).

### Exit criteria (must pass)
- First-time user completes onboarding with minimal confusion.
- Testers can identify at least 2 valid strategies.
- Repeat-session intent >60% in post-play survey.

## Phase D — Production with live balancing (ongoing)

### Required rituals
- Weekly balance review (economy, pacing, frustration points).
- Biweekly external playtest with scripted questions.
- Monthly "kill/keep" review for low-value features.

### Non-negotiables
- No feature merges without a player-facing feedback check.
- No milestone close without updated metrics and insights.
- Content throughput targets (events/dialogues/items) tracked per sprint.

## 5) Practical quality bars for the next game

## Player experience bars
- Player understands immediate goal in <60 seconds.
- Every major action has clear cause/effect feedback in <500 ms.
- At least one meaningful tradeoff appears every 2–3 minutes.

## Design bars
- Each system must answer: what decision does this create?
- No hidden rule ships without at least one readable telegraph.
- Minimum content variation thresholds set before alpha.

## Production bars
- Every sprint includes at least one external playtest.
- Every feature ticket includes success metric + instrumentation note.
- Scope cuts happen by value ranking, not implementation convenience.

## 6) 30-day action plan from today

## Week 1
- Run a focused teardown of current build (team + 3 players).
- Extract top 5 friction points and top 3 delight points.
- Write next-game experience brief.

## Week 2
- Build graybox prototype of new loop only.
- Add instrumentation hooks for session length and action frequency.
- Conduct first 8-person playtest.

## Week 3
- Iterate on top 3 pain points from playtest.
- Double content variety in the loop.
- Re-test with a fresh player cohort.

## Week 4
- Build vertical-slice candidate.
- Decide go/no-go based on exit criteria.
- Freeze a realistic roadmap with explicit cut list.

## 7) Team operating agreements for next project

- We will prioritize **validated fun** over feature count.
- We will test with real players every sprint.
- We will make hidden systems legible and fair.
- We will kill weak ideas quickly and reinvest in strong loops.

---

If we follow this process, the next game should feel better earlier, de-risk faster, and avoid spending months polishing a loop that players do not love.
