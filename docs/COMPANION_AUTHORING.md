# Companion Authoring — the Story / Adventure workshop

**This document is the contract.** When companion-driven Story/Adventure
behavior changes, edit this file first, then propagate to the prompt, the
engine, and the help panel (same order as `docs/COMBAT_CALCULATIONS.md`).

---

## 1. What this is

The companion (Aria by default) can **build the other two modes from ordinary
companion chat**. Trist says "set up a story for me about a lighthouse keeper
who stops being able to sleep", and she does the entire setup herself — genre,
length, content level, main character, narrator, and the creative brief behind
it — then the app plans the whole book in the background. He walks into Story
mode and it's waiting, already at section 1.

The point is **not** convenience. It's that the story is genuinely *hers*: her
taste, her read on him, her memories of their history, and her current mood are
baked into the plan before a word of prose exists. A settings form cannot do
that.

Two halves:

| Half | Where | What |
|------|-------|------|
| **READ** | `buildWorkshopContext()` in [src/main/companion-authoring.js](../src/main/companion-authoring.js) | Injects a `STORY & ADVENTURE WORKSHOP` block into her system prompt every companion turn: the catalogs she picks from, the current story library, adventure status, and the exact tag syntax. |
| **WRITE** | `CompanionAuthoring.processTags()` | Consumes the directives she emitted, creates/patches the real files, and kicks off background planning. |

---

## 2. The four tags

Parsed in [src/shared/response-parser.js](../src/shared/response-parser.js) and
handled in [src/main/companion-authoring.js](../src/main/companion-authoring.js).
All are stripped from the dialogue/thoughts panels before display.

### 2.1 `[CREATE_STORY]` — commission a new story

```
[CREATE_STORY]
{
  "title":           "optional — planning invents one if blank",
  "storyType":       "<slug from STORY_TYPES>",
  "storyLength":     "<slug from STORY_LENGTHS>",
  "startingContext": "the seed, 2–6 sentences",
  "authorBrief":     "HER brief — why this story, for him, now. 1–3 paragraphs.",
  "mainCharacter":   { "name": "optional", "gender": "optional" },
  "narratorMode":    "storyteller | companion",
  "settings": {
    "segmentLength":   "short | medium | long | epic",
    "choiceFrequency": "rare | normal | frequent",
    "descriptiveness": 1-5,
    "proseStyle":      1-5,
    "nsfwLevel":       "safe | adult | nsfw | hardcore"
  }
}
[/CREATE_STORY]
```

- Every enum is validated against the real catalog in `text-story-store.js`.
  An unknown value **falls back to a default**, it does not fail the creation —
  a story with the wrong genre slug is recoverable, a story that never got
  created is a broken promise to the user.
- `descriptiveness` / `proseStyle` are clamped to 1–5.
- Defaults when omitted: `storyType: custom`, `storyLength: short_story`,
  `narratorMode: storyteller`, settings from `DEFAULT_SETTINGS`.
- Malformed JSON → the block is recorded as `{ _parseError: true }`, nothing is
  created, and the user is told. **Never silently swallowed.**
- Max **one per response** (`MAX_PLANS_PER_TURN`); extras are reported and dropped.

### 2.2 `[CREATE_ADVENTURE]` — design a new campaign

```
[CREATE_ADVENTURE]
{ "tone": "<slug from ADVENTURE_TONES>", "setting": "dense, 2–6 sentences", "authorBrief": "her brief for the run" }
```

- There is exactly **one** adventure slot per character (the state files live in
  the character dir). Creating a campaign replaces the previous one.
- **A live campaign is never overwritten silently.** If existing state has
  `turnCount > 0` and `alive !== false`, the plan becomes a *pending proposal*:
  `companion:authoring` fires with `kind: 'adventure-proposed'`, the renderer
  shows a modal, and nothing is written until `authoring:resolve-adventure`
  comes back with `approved: true`.
- Adventure has **no narrator mode**. The GM always runs it and the companion
  is always *in* it as a party member — that's the mode's identity.

### 2.3 `[STORY_SETTINGS]` — adjust an existing story

```
[STORY_SETTINGS]
{ "slug": "required", "title": "optional", "narratorMode": "optional", "settings": { ...only changed fields... } }
```

Unknown slug → reported, nothing changed. No-op patches emit no notice.

### 2.4 `[STORY_NUDGE]` — steer a story's next section

```
[STORY_NUDGE] <slug> | <one-shot directive to that story's narrator>
```

Writes `state.pendingNudge`, which the existing turn pipeline consumes once and
then clears (`story:take-turn`). Same mechanism as the UI's nudge button.

---

## 3. Narrator mode

`state.narratorMode ∈ { 'storyteller', 'companion' }`, default `'storyteller'`.

**Deliberately NOT inside `state.settings`.** `settings` is writable by the
storyteller via its per-turn `[STATE].settings` diff; the narrator identity must
never be self-reassignable mid-story.

| Mode | Prompt |
|------|--------|
| `storyteller` | Unchanged from before this feature. Neutral novelist, **zero** companion context — no name, no memories, no mood. This separation is the whole point of Story mode's default and must stay intact. |
| `companion` | `buildCompanionNarratorBlock()` in [src/main/text-story-rules.js](../src/main/text-story-rules.js) replaces the identity opening with her: character definition, saved history (`masterSummary`), capped memories, user profile, emotional axes, and any active personality directive. |

Companion mode invariants:

1. **She is the teller, never a character.** No self-insertion into the prose,
   no addressing the reader inside `[STORY]`, no narrating her own feelings.
2. **`[DIALOGUE]` / `[THOUGHTS]` / `(emotion_id)` are forbidden** in this
   channel — they would break the story parser. The prompt says so explicitly.
3. **`characterRules` (rules.json) are NOT injected.** They contain
   companion-chat format mandates ("always end with an emotion tag") that
   directly conflict with the story output contract.
4. Memory caps: `COMPANION_NARRATOR_MEMORY_CAP` (40 user memories) and
   `COMPANION_NARRATOR_SELF_FACT_CAP` (25 self-facts), most recent first. This
   block rides in **every** turn prompt — it must stay a few KB.
5. Applies to the whole surface of that story: turn prompt, all planning-chain
   prompts, details generation, and the Ask-Storyteller channel.

Companion context is resolved by `_companionCtxFor(state)` in
`text-story-ipc.js`, which returns `null` unless the story is actually in
companion mode — so a missing/broken companion context degrades safely to
Storyteller mode rather than failing the turn.

---

## 4. The author's brief

`state.authorBrief` — set at creation, present on companion-commissioned
stories only. Injected by `_authorBriefBlock()` into **every** planning and turn
prompt, in *both* narrator modes: even when the neutral Storyteller writes the
prose, her intent is the reason the story exists and outranks genre convention.

The adventure equivalent is `state.authorBrief` on the adventure state, surfaced
to the GM through `formatStateSummary()` as a `CAMPAIGN BRIEF` block.

---

## 5. The background planning chain

`runSetupChain()` is defined inside `register()` in
[src/main/text-story-ipc.js](../src/main/text-story-ipc.js) and returned to
main.js. It mirrors the renderer's `_runSetupChain` but runs entirely in main,
so a companion-commissioned story is planned without the Story panel ever being
opened.

Stages (each one Claude CLI call):

1. Blueprint — **fatal if it fails**; nothing downstream can be planned.
2. Story overview.
3. Chapter skeleton (one call, all chapters).
4. Event skeleton — **one call per chapter**.
5. Event summaries — batched 2 per call.
6. Opening scene (`story:take-turn`), only when the log is empty.

Character/chapter *details* are intentionally excluded — the Story panel already
generates those on first open.

### 5.1 Spawn guards (mandatory — see `~/.claude/CLAUDE.md`)

Every stage spawns a `claude` process, and stage count scales with chapter
count, so all three guards from the subprocess-sweep rule are present:

| Guard | Value | Where |
|-------|-------|-------|
| Hard total-spawn ceiling per job | `MAX_STAGE_CALLS = 200` | `runSetupChain` |
| Consecutive-failure circuit breaker | `MAX_CONSECUTIVE_FAILURES = 5` | `runSetupChain` |
| Cooperative cancel, checked before every spawn | `shouldAbort()` | `runSetupChain` ← `CompanionAuthoring._cancelRequested` |

Plus: **stages are strictly sequential** (never parallel, each awaited to
completion, so at most one CLI process is alive), the job pump runs **one
planning chain at a time**, and the queue is bounded at
`MAX_QUEUED_JOBS = 5`.

Hitting a ceiling is **not silent**: the chain returns `aborted: true` with
warnings, and the banner tells the user the plan is partial and to finish it
with REGEN PLAN.

---

## 6. Events to the renderer

Channel `companion:authoring` (whitelisted in `preload.js`; consumed by
[src/renderer/js/companion-authoring-ui.js](../src/renderer/js/companion-authoring-ui.js)).

| `kind` | Meaning |
|--------|---------|
| `story-created` | Folder written, planning queued. |
| `plan-start` / `plan-progress` / `plan-done` | Chain lifecycle. `plan-progress` carries `label`, `calls`, `maxCalls`. |
| `story-failed` | Creation or planning failed. |
| `story-updated` / `story-nudged` | `[STORY_SETTINGS]` / `[STORY_NUDGE]` applied. |
| `adventure-proposed` | Needs confirmation — a live campaign would be replaced. |
| `adventure-created` / `adventure-declined` | Resolution. |
| `notices` | Fallback human-readable lines. |
| `status` | Queue/running snapshot. |

IPC: `authoring:status`, `authoring:cancel`, `authoring:resolve-adventure`.
Job state lives in the **main process**, so a renderer reload re-attaches to an
in-flight plan via `authoring:status`.

---

## 7. Deliberately out of scope

- **Deleting** stories or campaigns — user-only, from the UI.
- **Rewriting existing prose** — the log is append-only.
- **Taking turns** in a story or adventure on the user's behalf.
- **Replacing a live campaign without confirmation.**
- Authoring tags from the *story-mode* companion-chat channel: that channel
  doesn't inject the workshop context, so she won't emit them there. If that
  changes, `story:companion-chat` must also run `processTags`.

---

## 8. Touch-points checklist

Changing companion-authoring behavior means touching, in order:

1. **This document.**
2. `buildWorkshopContext()` — what she is told she can do.
3. `src/shared/response-parser.js` — tag extraction + display stripping.
4. `src/main/companion-authoring.js` — validation, side effects, job pump.
5. `src/main/text-story-store.js` / `text-adventure-store.js` — persisted fields.
6. `src/main/text-story-rules.js` — narrator identity + brief injection.
7. `src/renderer/js/companion-authoring-ui.js` — user-facing feedback.
8. `src/renderer/js/help-panel.js` — the articles
   `story-narrator-mode` and `story-companion-built`.
