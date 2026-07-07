# Story Guidelines Patch — Pacing, Planning, and Overrun Reporting

**Status:** design spec — all decisions confirmed. Ready to implement.
**Scope:** Story game mode only. Adventure and Companion Chat are not touched.
**Prerequisite:** the existing three-tier setup (blueprint → details → opening) and per-turn state diff.

## Confirmed design decisions

- **Setup calls:** unlimited. Chain as many focused calls as needed. Top-down design — broad first, then drill into details.
- **Detail depth:** the **story core** (point, reader experience, impetus, draw, conclusion) is exhaustively detailed. Chapter and event summaries are **broad structure** — enough for pacing but leaving room for the Storyteller to improvise the prose within.
- **Reports:** very visible. Sidebar banner on every report + persistent REPORTS tab. Reports are a debug tool — the visibility level and the whole REPORTS tab will likely be removed later once budgets stabilize.
- **Nudge feature:** disabled. Hide the button, ignore the function.
- **Inspector display:** every structural view in the inspector must be **human-readable formatted**, NOT raw JSON. This includes the existing BLUEPRINT tab (which currently dumps JSON) — it gets a proper structured display too.
- **Storage:** everything nested inside `state.storyBlueprint` in `story.json` (single canonical file). The blueprint is the container for the entire story's structure.
- **Story length is a user setup input.** Six presets: `poem`, `short_story`, `novelette`, `novel`, `story_book`, `epic`. This picker is asked in the initial story-setup dialog (before any Claude call) and passed into every downstream setup prompt so the Storyteller can scale its chapter and event counts + budgets accordingly.
- **Section = book page.** A section corresponds roughly to one to two pages of a printed book. Chapter and event budgets are set with this metric in mind — Claude sizes `sectionBudget` fields against the total-page target implied by the story-length picker.
- **Pacing pressure stays invisible in the prose (Q3 = b).** Wrap-ups must feel earned, not rushed. The reader cannot tell from prose alone that the Storyteller is on a countdown. Achieving this requires the Storyteller to plan section-by-section during setup so wrap-ups can be scripted, not scrambled.
- **Rules 14 and 17 are unified into a single anti-derailment rule (Q6 = b).** One long rule covering: the Storyteller may/must ignore or reshape the reader's chosen action when doing so is necessary to prevent plot blockages, story anomalies, paradoxes, or pacing collapse. The plan wins. The reader steers within it — they do not have the power to derail it. See §5.3 for the merged rule text.

## 1. Problem statement

Three linked failure modes in the current Story mode:

1. **Pacing drift.** The Storyteller gets caught in a scene and draws it out across 4–6 sections that should have been ~2. This happens because the Storyteller has NO budget for scene length; each turn it re-evaluates from scratch and often decides "let's stay here a little longer" indefinitely. The player experiences the story stalling.

2. **Insufficient planning.** The current blueprint has a plot summary, characters, a three-act arc, and 8–14 chapter titles. That's not enough structure to plan pacing against. There's no per-chapter breakdown of what happens, no per-event summary, no explicit connective tissue between chapters. The Storyteller improvises those in real time, which is where the pacing drift comes from.

3. **No overrun signal.** When the Storyteller realises it needs more time than the budget allows, there is no mechanism for it to say so. Overruns happen silently. The player and the developer have no data on which budgets are consistently underestimated versus which are genuinely realistic.

## 2. Design principles

- **Budgets, not caps.** The Storyteller sets its own budget at story creation. The system reminds it of the budget every turn but does not auto-truncate. Hard caps stay out of this patch — they can be added later if data supports it.
- **Course-correct, don't ignore.** When a scene is running long, the Storyteller must actively steer toward wrap-up. It cannot decide to keep milking a scene.
- **Everything is a document.** Story overview, chapter summaries, event summaries — each is a discrete record. Not one giant blob. This makes retrieval, display, editing, and future partial regen tractable.
- **Setup takes time; that's fine.** More back-and-forth calls at story creation are acceptable if they produce a substantially better plan. The user has already accepted a multi-minute setup phase for the current blueprint + details generation.
- **Overrun reports are data.** Every `[REPORT]` is stored and surfaced. Repeated overruns on a specific budget kind are actionable — they tell us whether the default budget was too tight or the model can't self-regulate.

## 3. Data model additions

### 3.1 Section budgets on chapters + events

Each chapter and each event carries an integer `sectionBudget` set by the Storyteller during setup, and a `sectionsUsed` counter that increments on every player-Storyteller round-trip that occurs within that chapter or event.

```jsonc
// storyBlueprint.chapters.list[i]
{
  "number": 3,
  "act": "beginning",
  "title": "The Ledger and the Sealed Letter",
  "sectionBudget": 4,       // NEW — planned length
  "sectionsUsed":   0        // NEW — increments each turn tagged to this chapter
}
```

Events (see §3.2 for what "event" means) live in a new `state.storyBlueprint.events[]` array parallel to chapters:

```jsonc
{
  "id": "receiving_the_ledger",
  "title": "Wren receives the ledger",
  "chapterNumber": 1,
  "sectionBudget": 2,
  "sectionsUsed":   0,
  "status": "pending"        // pending | active | resolved
}
```

Only ONE event is `active` at any time. When one resolves, the next event in the chapter becomes active.

### 3.2 What counts as an "event"

Not every scene shift. **An event is a discrete narrative unit inside a chapter that has a defined start, middle, and resolution.** Rule of thumb: a chapter has 2–5 events. An event has 1–4 sections. Events are what the Storyteller plans, budgets, and tracks against — chapters are for the reader's orientation; events are for the pacing machinery.

Examples inside Chapter 1 of the existing story:
- Event: *"Wren meets Mr. Fenn and receives the ledger"* — 2 sections.
- Event: *"Wren returns to the shop for the first time"* — 2 sections.
- Event: *"Wren finds the sealed letter and sets it aside"* — 1 section.

Total: 5 sections. Chapter 1 `sectionBudget` = 5.

### 3.3 Multi-doc summaries

Three new document collections stored inside `state.storyBlueprint`. **Detail depth is asymmetric by design:** the story overview is the ONE piece the Storyteller must know exhaustively. Chapter and event summaries are broad structure only — enough for pacing, not so much that they constrain the Storyteller's writing choices.

| Field | Shape | Detail depth | Contents |
|---|---|---|---|
| `storyOverview` | `{ point, readerExperience, impetus, draw, conclusion, themeReminders, characterCoreSummary }` | **Exhaustive.** | The one thing the Storyteller must have deeply internalized. See §3.3.1. |
| `chapterSummaries[]` | one per chapter | **Broad.** | Structure for pacing. See §3.4. |
| `eventSummaries[]` | one per event | **Broad.** | Structure for pacing. See §3.5. |

**Storage location:** all three collections nest inside `storyBlueprint` in `story.json`. The blueprint is the single canonical container for the story's structure. If any collection grows big enough to warrant a separate file later, that's a downstream refactor.

### 3.3.1 storyOverview schema (the story core)

The story overview is what the Storyteller MUST know cold. Every downstream setup call (chapter skeleton, event summaries, opening scene) receives the full overview in its prompt so nothing downstream can drift from the core.

```jsonc
{
  "point":            "What THIS STORY IS ABOUT. The thesis. Not a plot summary — a purpose. Why does this story exist? What is the reader supposed to walk away having felt or understood? Multi-paragraph if needed.",
  "readerExperience": "What the reader will actually EXPERIENCE from open to close. The emotional arc, the beats they'll live through, the moments that hit hardest. This is the experiential contract with the reader. Multi-paragraph.",
  "impetus":          "The thing that pushes the reader (and the main character) INTO the story. What makes them start? What are they drawn to?",
  "draw":             "The engine that keeps the reader turning pages. Why do they stay? What tension pulls them forward?",
  "conclusion":       "How the story resolves — not just the plot resolution but the emotional resolution. What is left at the end?",
  "themeReminders":   ["theme_1", "theme_2", "..."],
  "characterCoreSummary": "Every character who matters: name, role, what they represent, their function in the story's meaning. Deep — this is who these people ARE, not just what they do."
}
```

### 3.3.2 storyLength — user-selected size

Set at story creation time by the user via a picker in the initial setup dialog. Persisted in `storyBlueprint.storyLength` and passed into every setup-time prompt so the Storyteller sizes the story consistently.

```jsonc
"storyLength": {
  "preset":         "novel",           // one of the six enum values below
  "targetSections": 200,               // engine-computed midpoint, informational
  "sectionEqualsPages": "1–2"          // constant string reminder for the model
}
```

Enum values, with target section counts (Claude uses these as planning anchors, not caps):

| preset        | Rough analog                                       | Target sections | Chapter range   |
|---------------|----------------------------------------------------|-----------------|-----------------|
| `poem`        | A single lyric arc; a fable                        | 4 – 10          | 1               |
| `short_story` | A short-story-collection entry                     | 12 – 30         | 1 – 4           |
| `novelette`   | Novelette / light novel (JP media term)            | 40 – 80         | 5 – 10          |
| `novel`       | Standard novel                                     | 120 – 250       | 10 – 25         |
| `story_book`  | Long novel / thick book (600+ printed pages)       | 300 – 500       | 25 – 40         |
| `epic`        | Odyssey-scale; multi-book epic                     | 600 – 1500      | 40 – 80         |

The **target section count** is a planning anchor. Chapter and event `sectionBudget` values across the story SHOULD roughly sum to this target. The system does not enforce this — the Storyteller may go over or under during setup, and overruns via `[REPORT]` at turn time can grow the total further.

**Section length definition (repeated to Claude in every prompt):** one section = one to two pages of a printed book. Sections are the unit Claude budgets against. If the reader picks `novel` (~200 sections), a chapter with `sectionBudget: 8` will feel like an 8- to 16-page chapter of a novel.

### 3.4 Chapter summary schema (broad structure)

```jsonc
{
  "chapterNumber": 3,
  "sectionBudget": 4,
  "kickoff":       "How the chapter opens — one to two sentences",
  "blendFromPrior": "How the previous chapter's end flows into this chapter's start (one sentence)",
  "blendToNext":    "How this chapter's end sets up the next chapter's start (one sentence)",
  "charactersInvolved": ["id_1", "id_2"],
  "driver":         "What pushes the characters and plot through the chapter (one to two sentences)",
  "closer":         "How the chapter ends (one to two sentences)",
  "importance":     "Why this chapter matters — one paragraph"
}
```

Everything is short prose — enough for the Storyteller to know the chapter's shape and where it fits in the arc, not so much that the Storyteller's turn-by-turn prose is over-constrained.

### 3.5 Event summary schema (broad structure)

```jsonc
{
  "id":                 "receiving_the_ledger",
  "chapterNumber":      1,
  "orderInChapter":     1,
  "title":              "Wren receives the ledger",
  "sectionBudget":      2,
  "sectionsUsed":       0,
  "status":             "pending",
  "kickoff":            "What starts this event (one sentence)",
  "who_is_involved":    ["main_character", "mr_fenn"],
  "reader_experience":  "The beat the reader will live through (one to two sentences)",
  "why_it_matters":     "Its role in the arc (one to two sentences)",
  "aftermath":          "What ends this event and leads into the next (one sentence)"
}
```

Events are the pacing atoms. The schema is deliberately short so the Storyteller has room to write the actual prose without feeling boxed in.

## 4. Setup-time flow (top-down, unlimited call chain)

Design principle: **top-down.** We commit to broad structure first (what is the story about? what will the reader feel?), then drill into successively narrower detail (acts → chapters → events → per-event beats). Each call knows everything committed to above it, so consistency is enforced by construction — the Storyteller cannot invent a chapter that contradicts the story overview, because the overview is in its prompt.

Setup is a chain of one-purpose Claude calls. Each call is small enough to complete under any reasonable timeout. Total call count is intentionally uncapped — the ceiling is whatever the story needs, not what fits in a target wall time.

```
Stage 0.  Length picker + prompt  (user input — dialog, no Claude call)
Stage 1.  Blueprint               (exists — receives length preset)
Stage 2.  Story Overview          NEW  — the core: point, reader experience, impetus, draw, conclusion
Stage 3.  Chapter Skeleton        NEW  — for each chapter: sectionBudget + one-paragraph shape + connective tissue
Stage 4.  Chapter Summaries       NEW  — per-chapter deep summary (batched, small)
Stage 5.  Event Skeleton          NEW  — for each chapter: 2–5 events with sectionBudget + one-line shape
Stage 6.  Event Summaries         NEW  — per-event deep summary (batched, small)
Stage 7.  Details                 (existing — deep character bibles, opt-in via REGEN DETAILS button)
Stage 8.  Opening scene           (exists)
```

Stage 0 is a synchronous UI-only step. The existing new-story dialog gains a **STORY LENGTH** radio group with six options + a one-line description of each (from the table in §3.3.2). The chosen preset is stored in `storyBlueprint.storyLength` and injected into every downstream setup prompt so Claude sizes the plan to that target.

Batching sizes are per-batch and open-ended:

- **Story Overview:** one call. Small output.
- **Chapter Skeleton:** one call for the whole chapter list. Small output.
- **Chapter Summaries:** batches of 2 chapters per call. Larger output per batch.
- **Event Skeleton:** one call per chapter (12 chapters → 12 calls). Small output each.
- **Event Summaries:** batches of 2 events per call.

If any batch times out, only that batch retries — every other batch's work stays saved. There is no all-or-nothing total setup.

Wall-time estimate: for a 12-chapter, ~20-event story, on the order of 25–35 calls total, 15–25 minutes total. **This is the trade-off for reliable structured setup that never times out on a single mega-call.** A user-visible progress overlay reports current stage: *"Planning chapter summaries — batch 3 of 6…"*.

**Interaction with `story:generate-details`:** deep character details (visuals, outfits, quirks, voice, AI prompts) remain OPT-IN via the existing `↻ REGEN DETAILS` button — they are orthogonal to pacing. Chapter and event summaries generated at Stages 4 and 6 become the canonical pacing data. The existing `chapterDetails[]` field stays as descriptive metadata (redundant but harmless).

## 5. Turn-time flow (extended)

### 5.1 Section counter tracking

Every turn, after the Storyteller emits its `[STATE]` diff:

1. Engine reads which chapter and event were `active` at the start of the turn.
2. Engine increments `chapters.list[currentChapter].sectionsUsed` by 1.
3. Engine increments `events[activeEventId].sectionsUsed` by 1.
4. If the Storyteller's `[STATE]` diff includes `storyBlueprint.events.update` marking the current event as `resolved`, engine transitions to the next event in the chapter (sets its status to `active`).
5. If the Storyteller's `[STATE]` diff includes `chapters.currentChapter` advancing, engine resolves any still-pending events in the old chapter (marks them `abandoned` with a warning entry in the debug log) and begins the new chapter's first event.

### 5.2 What the Storyteller sees in the prompt every turn

Every turn's system prompt gains a **PACING CONTRACT** block near the top (after `USER CONTEXT`, before the blueprint):

```
=== PACING CONTRACT ===
Current chapter: 3 · "The Ledger and the Sealed Letter"
  Chapter budget: 4 sections · used so far: 2 · remaining: 2
Current event:   "Wren receives the ledger" (event 1 of 3 in this chapter)
  Event budget:   2 sections · used so far: 1 · remaining: 1

You are on section 2 of this event's 2. The event MUST resolve within this
turn or the next at the outside. Drive it toward its aftermath. Do not
introduce new complications, side conversations, or sensory digressions.
When you emit [STATE], mark the current event's status as "resolved" and
advance to the next event in the chapter (or the next chapter if this
was the chapter's last event).
=== END PACING CONTRACT ===
```

The block's tone escalates as `remaining` decreases:
- `remaining >= 2`: neutral reminder ("You have N sections left").
- `remaining == 1`: firm ("Drive toward resolution now").
- `remaining == 0`: mandatory ("This event MUST resolve this turn").
- `remaining < 0`: overrun ("This event has run over budget — resolve immediately or emit `[REPORT]` — see below").

### 5.3 Unified anti-derailment rule (replaces rules 14 and 17)

The existing rule 14 (Graceful Redirect) and the newly-proposed rule 17 (Honor the Pacing Contract) are merged into a **single super-rule** that protects both the plot spine AND the pacing contract. Same trigger vocabulary, same toolkit — the reader steers, but they cannot break.

> **14. HONOR THE PLAN — PLOT SPINE AND PACING CONTRACT.**
>
> This story has a plan. That plan lives in `storyOverview`, `chapterSummaries`, and `eventSummaries`, and it lives in the PACING CONTRACT block above. **The plan wins. The reader steers within it.** They do not have the power to derail it.
>
> When the reader's chosen action WOULD break the plan — by removing a required character, skipping a fixed event, sidestepping a planted hint, opening a scene the plan doesn't want, OR by demanding more time than the event's budget can accommodate — you MUST fight to preserve the plan. Three permitted responses, in order of preference:
>
> 1. **Flow.** Reshape the outcome so the reader's action lands *inside* the planned result. Their gesture is honored; its consequence is what the plan needed. This is best whenever it's plausible.
> 2. **Redirect.** Let the action fail, dissolve mid-motion, or land differently than intended. The reader gets narrative attention; the plan is not moved off its rails. Use the graceful-redirect toolkit (attempt fails / motive dissolves / outcome redirects / meaning alters).
> 3. **Ignore.** In extreme cases — where honoring the action at all would create a paradox, kill a required character, permanently break a fixed event, or blow the pacing contract past recovery — you may treat the action as not-taken and continue the scene as the plan requires. Use sparingly; overuse of this option breaks the illusion of reader agency.
>
> **No derailment. No indefinite scene extension. No plot bypass.** If pacing pressure and plot pressure conflict, pacing wins — a delayed climax hurts more than a rushed connective scene. If you cannot resolve the pressure within the remaining budget, emit `[REPORT]` (see §6) and continue the scene under the extended budget the report grants.
>
> **The reader has agency over surface details, not over the story's shape.**

**Why unify:** rule 14 (protect key characters / fixed events) and rule 17 (protect the pacing budget) share the same trigger pattern ("reader tried something the plan can't absorb") and the same toolkit (flow / redirect / ignore). Two rules invited the Storyteller to fire only one at a time; one super-rule fires whenever ANY plan-preserving pressure is active, which is closer to how the plan actually breaks.

### 5.4 State diff schema additions

The `[STATE]` block schema example gains:

```jsonc
{
  "storyBlueprint": {
    "events": {
      "update": [
        { "id": "receiving_the_ledger", "status": "resolved" }
      ],
      "add": [
        // only if the Storyteller genuinely needs to invent a new event
        // mid-chapter — should be rare and paid for from the remaining
        // chapter budget
      ]
    }
  }
}
```

## 6. The [REPORT] escape valve

### 6.1 When the Storyteller emits it

Any turn where the Storyteller has determined it truly cannot resolve the active event within the remaining budget, it MUST emit a `[REPORT]…[/REPORT]` block alongside the normal turn output.

```
[REPORT]
kind:            "event_overrun" | "chapter_overrun" | "story_overrun"
scope_id:        "receiving_the_ledger"   // event id, chapter number, or "story"
original_budget: 2
requested_new_budget: 4
reason:          "Wren's grief-mad shout and the introduction of Juno both
                  belong inside this event and can't be split without breaking
                  the emotional beat. I need two more sections to land the
                  aftermath."
suggested_impact: "Chapter 1 total grows by 2 sections."
[/REPORT]
```

Rules:
- `[REPORT]` is emitted BEFORE `[SCENE]` in the response so the parser can detect it up front. Emitting it doesn't cancel the rest of the response — the turn still proceeds as narrated.
- Only ONE report per turn. If both event and chapter are overrunning, the report is for the more granular scope (event).
- The Storyteller is NOT obligated to emit `[REPORT]` if it can resolve on time. Only fire when actually asking for more budget.

### 6.2 Engine handling

- Engine extracts and stores the report in a new persistent file: `stories/<slug>/story-reports.json` (append-only, uncapped).
- Engine automatically updates the target's `sectionBudget` to the `requested_new_budget`. The next turn's PACING CONTRACT reflects the new budget.
- Renderer receives a `story:report` event and shows a **loud, high-visibility banner** at the top of the story panel:

  > ⚠ **STORYTELLER REPORT — Event overrun**
  > `receiving_the_ledger` requested 2 → 4 sections
  > *"Wren's grief-mad shout and the introduction of Juno both belong inside this event and can't be split without breaking the emotional beat. I need two more sections to land the aftermath."*
  > [DISMISS] [OPEN REPORTS TAB]

  Banner is visible until dismissed OR the user reads it in the REPORTS tab. Bright amber background, does not auto-hide. **This is a debug-mode UX** — reports are supposed to be conspicuous while we're tuning budgets. The whole banner + REPORTS tab will be removed once budgets stabilize.

### 6.3 User-facing analytics

A new inspector tab **REPORTS** shows the full history:

| Section | Kind | Scope | Original | Requested | Reason |
|---|---|---|---|---|---|
| 7 | event_overrun | receiving_the_ledger | 2 | 4 | Wren's grief-mad shout… |
| 14 | chapter_overrun | 2 | 5 | 7 | The Pell twins' arrival wants its own scene… |

Two aggregate metrics displayed at the top of the tab:

- **Event overrun rate:** X of Y events reported overrun (percentage).
- **Average request delta:** mean (`requested_new_budget − original_budget`) across all reports.

These metrics answer the user's stated question: *"is the default budget too tight, or is the Storyteller unable to self-regulate?"* If most events report a +50% delta consistently, the default is probably too tight and future stories should get more generous defaults. If reports are rare but the actual `sectionsUsed` still consistently exceeds `sectionBudget`, the model is failing to self-regulate and we need hard caps.

## 7. UI / renderer implications

### 7.1 Sidebar — new PACING card

Between the SCENE card and the SCENE CHARACTERS card, a new sidebar card:

```
─────────────────
   PACING
─────────────────
  Chapter 3 · 2/4
  Event: Wren receives the ledger · 1/2
─────────────────
```

Colour-coded: neutral while under budget, amber at `remaining <= 1`, red at overrun. Clicking the card opens a REPORTS overlay if any reports exist for the current chapter or event.

### 7.2 Inspector — new tabs (all human-readable, NOT raw JSON)

Every tab that shows blueprint / summary / plan data must render it in a **formatted human-readable structure** — sections, headings, prose. Raw JSON dumps are unacceptable as the primary view. A "SHOW RAW JSON" toggle can be exposed for developer inspection but the default is always structured.

New tabs:

- **STORY OVERVIEW** — the seven fields of `storyOverview` rendered as a real reader-friendly card:

  > **THE POINT OF THIS STORY**
  > *(exhaustive prose)*
  >
  > **THE READER'S EXPERIENCE**
  > *(exhaustive prose)*
  >
  > **IMPETUS** — *(one paragraph)*
  > **DRAW** — *(one paragraph)*
  > **CONCLUSION** — *(one paragraph)*
  >
  > **THEMES** — *[chip, chip, chip]*
  >
  > **CHARACTERS (the ones who matter)**
  > *(character-by-character prose)*

- **CHAPTER SUMMARIES** — split-pane pattern (like CHARACTERS): chapter list on left, selected chapter's summary rendered as labeled fields on the right. Small pacing bar per chapter row.

- **EVENT SUMMARIES** — split-pane, grouped by chapter in the left list. Selected event shows the six-field summary as labeled fields, plus a prominent pacing indicator (`sectionsUsed / sectionBudget`).

- **REPORTS** — filterable table with columns Section / Kind / Scope / Original / Requested / Delta / Reason. Reason column expands on click.

### 7.2b Inspector — retrofits to existing tabs

- **BLUEPRINT tab** — the current raw-JSON dump is replaced with a formatted structured display. Sections for plot summary, premise, themes, tone, art style, key characters (as a grid), side characters (compact list), arc (three columns for beginning/middle/end), fixed events (list with status), planted hints, chapters (list with pacing bars), planning position. A **"SHOW RAW JSON"** button in the tab toolbar reveals the JSON dump for developer inspection.
- **STATE tab** — same treatment: structured display of the state fields, "SHOW RAW JSON" toggle.
- **LOG tab** — already a structured view. No change beyond adding the "SHOW RAW JSON" toggle for consistency.

The existing CHAPTERS tab (deep-dive character-detail-level chapter data) stays as-is but relabeled *"deep dives — descriptive, not pacing-canonical"* in its meta line.

### 7.3 Nudge button — HIDDEN

The **🎯 NUDGE** button in the story header is hidden (via `display: none` in CSS) and the `story:set-nudge` IPC ignored on the renderer side. The main-process handler stays wired (so nothing breaks if we re-enable later) but no code path calls it. Any existing `state.pendingNudge` values are ignored by the prompt builder — the READER DIRECTIVE block never renders.

### 7.3 Inspector — pacing on the CHAPTERS tab

Each chapter row in the CHAPTERS jump list gains a small pacing bar:

```
Ch 1 · The Ledger and the Sealed Letter    [██████████] 5/5 ✓
Ch 2 · The Broken Tin Lantern              [████░░░░░░] 2/5
Ch 3 · Elias Comes Calling                 [░░░░░░░░░░] 0/4
```

## 8. Non-goals (deferred)

- **Hard caps.** No auto-truncation of the turn or forced advancement. The Storyteller must self-regulate under the PACING CONTRACT; overruns produce `[REPORT]`s that we learn from.
- **Retroactive rebudgeting for the existing story.** *The Lantern on Cormorant Street* was created without any of this data. It gets no automatic upgrade. Optional: a new **REGEN PLAN** button in the inspector runs the setup calls 2–4 on an existing story to backfill the summaries. This can be a follow-up.
- **Storyteller learning across stories.** Each story's budgets are set fresh. No cross-story adaptation.
- **Event summaries authored by the reader.** Read-only for now. Ask-Storyteller can retcon them via the existing state-diff mechanism if needed.

## 9. All questions resolved

- ✅ **Q1 batching sizes / call ceiling:** unlimited chained calls; top-down design.
- ✅ **Q2 event granularity:** guidance only. Broad structure except the story core.
- ✅ **Q3 pacing pressure visible in prose:** **(b)** — pressure stays invisible. Wrap-ups feel earned. Requires the Storyteller to plan section-by-section during setup so wrap-ups can be scripted. NEW: story-length picker at setup so Claude sizes the plan against a target section count.
- ✅ **Q4 report visibility:** loud banner + persistent tab. Debug tool, will be removed once budgets stabilize.
- ✅ **Q5 nudge interaction:** nudge is disabled entirely. Button hidden. Function ignored.
- ✅ **Q6 rules 14/17 unified or separate:** **(b)** — merged into one super-rule. See §5.3 for the merged text. Plan wins. Reader steers within it.
- ✅ **Q7 storage:** nested inside `storyBlueprint` in `story.json`. All inspector views must be human-readable formatted, not raw JSON.

## 10. Rollout plan

1. **Data layer** — extend `text-story-store.js` with:
   - `storyBlueprint.storyLength` (preset + targetSections + sectionEqualsPages).
   - `storyBlueprint.storyOverview` object.
   - `storyBlueprint.chapterSummaries[]`, `storyBlueprint.eventSummaries[]`, `storyBlueprint.events[]`.
   - `chapters.list[i].sectionBudget` / `sectionsUsed`.
   - `applyStateDiff` support for `events.update` / `events.add` / `chapters.list[i].sectionsUsed` mutations.
   - Forward-compat backfill for old stories (default `storyLength.preset = 'novel'`, empty overview/summaries, `sectionBudget: 3` per chapter, no events until REGEN PLAN).
2. **Rules module** — new prompt builders: `buildStoryOverviewPrompt`, `buildChapterSkeletonPrompt`, `buildChapterSummariesPrompt(batchIds)`, `buildEventSkeletonPrompt(chapterNumber)`, `buildEventSummariesPrompt(batchIds)`. Every builder receives the `storyLength` preset + target section count. Update `buildBlueprintPrompt` to receive `storyLength`. Update `buildTurnPrompt` with:
   - The PACING CONTRACT block (§5.2).
   - The unified rule 14 replacing the current rule 14 AND removing the placeholder for rule 17 (§5.3).
   - The `[REPORT]` block instructions (§6.1).
3. **IPC** — new handlers `story:generate-story-overview`, `story:generate-chapter-skeleton`, `story:generate-chapter-summaries`, `story:generate-event-skeleton`, `story:generate-event-summaries`. Chain them in the setup flow with per-stage progress events (`story:setup-progress`). Parse `[REPORT]` blocks in `story:take-turn`, persist to `stories/<slug>/story-reports.json`, apply the requested budget to the target, emit `story:report` events.
4. **Renderer** —
   - Add STORY LENGTH picker to the new-story dialog (Stage 0).
   - Extend the setup progress overlay with new stages (2–6).
   - PACING sidebar card between SCENE and SCENE CHARACTERS cards.
   - Four new inspector tabs (STORY OVERVIEW / CHAPTER SUMMARIES / EVENT SUMMARIES / REPORTS) — all human-readable formatted.
   - Retrofit BLUEPRINT and STATE tabs with structured views + "SHOW RAW JSON" toggle.
   - Pacing bars on the chapters jump list.
   - Loud report banner.
   - Hide the NUDGE button via CSS.
5. **Migration path** — new stories get the full flow. Existing stories get a **REGEN PLAN** button in the inspector's STORY OVERVIEW tab that runs Stages 2–6 against the existing blueprint. Users are prompted to also pick a `storyLength` at that time (defaults to `novel` if they cancel).
6. **Help articles** — one new article per major concept (Story Length, Pacing Contract, Event Summaries, Reports, Anti-Derailment Rule).

## Confidence

This spec covers what you asked for (pacing budgets + multi-doc planning + `[REPORT]` escape valve) and identifies the design choices I made where you said "figure it out" (event granularity, batching sizes, storage location) so you can override any of them. The six open questions in §9 are the ones I genuinely need your call on before I code.
