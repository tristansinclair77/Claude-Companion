# RPG Battle Scaling Tester — Design Document v2
## with Claude AI Integration

---

## Purpose

A standalone dev/debug pop-out for diagnosing combat balance. Claude is a first-class participant — it has full visibility into the current tester state at all times, can read what you're looking at, suggest changes, and issue live commands that directly manipulate the tester UI without you having to touch a single control.

---

## Window Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚙ BATTLE SCALING TESTER                                                  [✕] │
├─────────────────────┬───────────────────────┬──────────────────┬────────────┤
│  PLAYER RIG         │  ENEMY                │  COMBAT LOG      │  CLAUDE    │
│                     │                       │                  │            │
│  (Column 1)         │  (Column 2)           │  (Column 3)      │ (Column 4) │
│                     │                       │                  │            │
└─────────────────────┴───────────────────────┴──────────────────┴────────────┘
```

Four columns. Claude occupies the rightmost column and is always visible — not a tab, not a modal. The AI's context is always the live state of the other three columns.

---

## Column 1 — Player Rig

### Controls

| Control | Values | Description |
|---|---|---|
| Char Level | 1–200 (editable) | Drives `levelBonus = level × 2` in ATK formula |
| Base Stats | STR / VIT / AGI / LCK / CHA (editable per stat) | Direct numeric inputs, not locked to character DB |
| Zone Level | 1–400 | Determines gear stat range when rolling |
| Rarity | common → legendary | Applied to rolled items |
| Slot | all 9 slots + "random" | Target slot for single roll |
| **ROLL PIECE** | — | Generate one item, equip it |
| **ROLL FULL RIG** | — | Generate all 9 slots at current zone level + rarity |
| **CLEAR GEAR** | — | Unequip everything |
| **USE SAVED CHAR** | — | Load real character + equipped gear from DB |

### Equipped Gear Table

One row per slot. Columns: slot · item name (rarity-colored) · key bonus numbers. Clicking a row expands the full stat list inline. Rolled item details are stored in memory so Claude can reference them by name.

### Live Player Stats (auto-computed)

```
Effective ATK:   —   = (level×2) + STR + gearATK + gearSTR×0.5
Effective DEF:   —   = VIT÷2 + gearDEF + gearVIT×0.2
Max HP:          —   = 40 + VIT×8  (soft cap 300)
AGI:             —
LCK:             —
Crit Chance:     —   = LCK × 0.5%  + weaponBonus
```

All values recompute instantly when any input changes.

---

## Column 2 — Enemy

### Controls

| Control | Values | Description |
|---|---|---|
| Zone | Dropdown, all zones by name | Auto-fills zone level range and bracket |
| Zone Level | Numeric, clamped to zone min/max (overridable) | Drives budget formula |
| Bracket | minion → god_tier | Auto-detected from tier, manually overridable |
| Archetype | balanced / glass_cannon / tank / assassin / berserker / fortress / trickster / caster | Stat distribution |
| Shiny | Checkbox | ×2.5 HP, ×2 ATK, ×1.5 DEF |
| Boss | Checkbox | budget ×3 |
| **PREVIEW ENEMY** | — | Compute and display stats, no fight |
| **FIGHT 1 TURN** | — | One exchange, update both HPs |
| **FIGHT TO DEATH** | — | Auto-loop until death, append all turns to log |
| **RESET PLAYER HP** | — | Restore player to max HP |

### Enemy Stats Display

```
Name:       Grim Stalker
HP:         847 / 847
ATK:        312
DEF:        249
AGI:        62
Budget:     5,180   (baseBudget:50 × 41^1.3)
Bracket:    scout
Archetype:  balanced
```

Budget formula shown explicitly — `baseBudget × zoneLevel^1.3` — so Claude and the developer can see the raw math at a glance.

### Player State

```
Current HP:  480 / 480   [RESET]
```

Persists across FIGHT 1 TURN clicks. FIGHT TO DEATH loops until one side reaches 0.

---

## Column 3 — Combat Log

Same CSS classes as the real in-game combat log. Each entry includes:

- Turn counter prefix: `[T1]`, `[T2]`, …
- Player attack line: hit/miss, raw ATK, final damage after DEF, crit flag
- Enemy attack line: hit/miss, raw ATK, final damage after DEF, crit flag
- HP summary line after each turn: `│ Player: 312/480 │ Enemy: 535/847 │`
- On fight end: `★ Player wins — 7 turns` or `☠ Player dies — turn 3`

**CLEAR LOG** button at bottom.

The full log text is included in Claude's context on every message, so Claude can reference "turn 3 where you got one-shot" without you having to describe it.

---

## Column 4 — Claude AI

### Always-On Context

Every message Claude receives is automatically prepended with a **state snapshot** of the tester. The user never has to describe what they're looking at:

```
[TESTER STATE]
Player: LV 20 | ATK 82 | DEF 18 | HP 200 | AGI 12
Gear:   weapon(common, zl5) | chest(uncommon, zl5) | [7 empty slots]
Enemy:  scout bracket | zoneLevel 41 | archetype balanced
        Budget 5,180 | ATK 312 | DEF 249 | HP 847
Last fight: Player died turn 1 (enemy hit for 294 dmg, player HP was 200)
[/TESTER STATE]
```

Claude always knows what you're seeing. You never have to copy-paste numbers.

### Claude Can Issue Tester Commands

Claude's responses are parsed for structured command directives. When Claude wants to adjust the tester, it includes directives inline. These are executed automatically by the renderer before displaying Claude's message:

```
[CMD: SET_CHAR_LEVEL 30]
[CMD: SET_BASE_STAT vit 60]
[CMD: ROLL_FULL_RIG zone_level=15 rarity=uncommon]
[CMD: PREVIEW_ENEMY zone=darkwood_forest zone_level=11 archetype=balanced]
[CMD: FIGHT_TO_DEATH]
[CMD: SET_BRACKET_BUDGET scout 14]
[CMD: SET_ZONE_LEVEL 11]
```

The full command surface:

| Command | Arguments | Effect |
|---|---|---|
| `SET_CHAR_LEVEL` | `<1–200>` | Updates char level field, recomputes stats |
| `SET_BASE_STAT` | `<stat> <value>` | Sets STR/VIT/AGI/LCK/CHA directly |
| `SET_ZONE_LEVEL` | `<1–400>` | Updates zone level in both panels |
| `SET_RARITY` | `<rarity>` | Updates rarity dropdown |
| `ROLL_FULL_RIG` | `zone_level=N rarity=X` | Generates all 9 slots |
| `ROLL_PIECE` | `slot=X zone_level=N rarity=X` | Generates one slot |
| `CLEAR_GEAR` | — | Empties all slots |
| `PREVIEW_ENEMY` | `zone_id=X zone_level=N bracket=X archetype=X` | Generates enemy display |
| `FIGHT_ONE_TURN` | — | Executes one combat exchange |
| `FIGHT_TO_DEATH` | — | Loops to completion |
| `RESET_PLAYER_HP` | — | Restores player HP to max |
| `SET_BRACKET_BUDGET` | `<bracket> <new_baseBudget>` | Temporarily overrides the bracket's baseBudget in memory — **does not persist to source code** |
| `SHOW_FORMULA` | `enemy_budget\|player_atk\|player_def\|player_hp` | Claude requests that the log display the full expanded formula with current numbers |

Commands in Claude's reply are stripped from the visible message before display — the user sees only natural language.

### Executed Action Receipt

After each command batch runs, a single line is appended to the combat log in a neutral color:

```
[AI] → ROLL_FULL_RIG zl=15 rarity=uncommon · SET_ZONE_LEVEL 15 · PREVIEW_ENEMY darkwood_forest
```

This creates an audit trail of what Claude changed.

### Temporary vs. Persistent Overrides

`SET_BRACKET_BUDGET` (and similar formula-override commands) mutate an **in-memory copy** of the constants, not the source file. After Claude recommends a budget change, the user sees the effect immediately. A **"Write to Source"** button appears alongside any active override, which writes the corrected value directly to `rpg-constants.js` once the user confirms it's right.

```
⚠ scout.baseBudget overridden: 50 → 14
[Preview only — Write to Source]
```

### Chat Input

Standard single-line input at the bottom of Column 4 with a Send button and Shift+Enter for multiline. Placeholder text: `"Ask about balance, request tests, or tell Claude to adjust values..."`

Example interactions:

> **User:** Why am I dying instantly in Darkwood Forest?
>
> **Claude:** Your effective ATK is 82 and DEF is 18. The scout bracket at zone level 11 generates a budget of `50 × 11^1.3 ≈ 869`, giving a balanced enemy roughly ATK 217 and DEF 174. You're dealing `max(1, 82−174) = 1` damage per hit, and taking `max(1, 217−18) = 199` per hit with only 200 HP — so one hit kills you. The bracket budget is the problem. Let me show you what a sane transition looks like:
>
> *[CMD: SET_BRACKET_BUDGET scout 14]*
> *[CMD: PREVIEW_ENEMY zone=darkwood_forest zone_level=11 archetype=balanced]*
> *[CMD: FIGHT_TO_DEATH]*

> **User:** Make my character tankier and try again
>
> **Claude:** I'll pump VIT to 80 and give you zone-11 uncommon chest + boots, then retry:
>
> *[CMD: SET_BASE_STAT vit 80]*
> *[CMD: ROLL_PIECE slot=chest zone_level=11 rarity=uncommon]*
> *[CMD: ROLL_PIECE slot=feet zone_level=11 rarity=uncommon]*
> *[CMD: FIGHT_TO_DEATH]*

---

## State Snapshot Format (sent to Claude on every message)

```
[TESTER STATE]
Char Level: {n}
Base Stats: STR {n} | VIT {n} | AGI {n} | LCK {n} | CHA {n}
Effective:  ATK {n} | DEF {n} | HP {n}/{n} | CritChance {n}%

Gear ({n}/9 slots equipped):
  weapon  [{rarity}] {name} — ATK+{n} STR+{n}
  chest   [{rarity}] {name} — DEF+{n} VIT+{n}
  [empty slots listed as —]

Enemy:
  Zone: {name} (tier {n}) | ZoneLevel: {n}
  Bracket: {id} | baseBudget: {n} (override: {n} or none)
  Budget Total: {n} = {baseBudget} × {zoneLevel}^1.3
  Archetype: {id} | Shiny: {bool} | Boss: {bool}
  ATK: {n} | DEF: {n} | HP: {n} | AGI: {n}

Active Overrides: {list or none}

Last Combat Summary:
  {last 20 log lines, or "no combat yet"}
[/TESTER STATE]
```

---

## System Prompt Injected for the Tester

The tester sends a dedicated system prompt to Claude for this context:

```
You are acting as a combat balance analyst for an RPG game. You have full read access
to the tester state shown above and can issue tester commands to adjust values on the fly.

Commands are written as [CMD: COMMAND_NAME args] in your response and are executed
automatically. You can chain multiple commands. Use them freely when you want to
demonstrate a balance point — don't just describe what should happen, show it.

When suggesting balance changes (e.g. bracket budgets), explain the math, make the
change with CMD, run a fight to verify, then say whether it works. If a change looks
good, remind the user they can click "Write to Source" to commit it.

Never break character as a balance analyst. Be direct and numerical.
```

---

## Data Flow

```
User types message
        ↓
Renderer bundles [TESTER STATE] + message → IPC → main process
        ↓
rpg-tester-ipc.js calls claude-bridge with tester system prompt
        ↓
Claude response returns
        ↓
Renderer parses [CMD: ...] directives → executes each command → updates UI
        ↓
Stripped response displayed in Column 4
        ↓
Combat log appends [AI] action receipt line
```

---

## File Structure

```
addons/rpg_adventure/
  src/
    rpg-tester-ipc.js         ← IPC handlers + Claude bridge call
  ui/
    windows/
      rpg-tester.html         ← window shell
    rpg-tester.js             ← renderer: all four columns, command parser, state builder
    rpg-tester.css            ← inherits rpg.css variables
  preload/
    rpg-tester-preload.js     ← testerAPI contextBridge
```

Launched via `rpg:open-tester` IPC, added to the DEV button dropdown or a direct keyboard shortcut from the adventure window.

---

## Out of Scope (v1)

- Status effects / abilities in simulation
- Multi-enemy rooms
- Saving/exporting tester sessions
- Persistent stat overrides (write-to-source covers the important case)
- Auto-running thousands of simulations for statistical output
