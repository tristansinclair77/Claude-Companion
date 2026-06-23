# Soundtrack Bible — Organization & Search Guide

The canonical reference for the Aria Adventure music library. Distilled from
`Soundtrack_Bible.docx` (the original Word catalogue) and applied to the 336 MP3s
in `music/`.

This doc covers:
- The bible's four-field schema (mood, energy, function, style tags)
- The 12-category folder layout used on disk
- How files map to bible entries (and where variants live)
- How to search by mood / energy / function in a tagged music player
- The ID3 tag schema written to each MP3
- Workspace coverage report

> The full canonical metadata for all 167 tracks is stored as JSON at
> [`ref/_bible.json`](../ref/_bible.json). The docx is preserved at
> [`ref/Soundtrack_Bible.docx`](../ref/Soundtrack_Bible.docx) if you need the
> formatted version.

---

## The Four Fields

Every track in the bible carries four searchable fields:

| Field | Example | Purpose |
|---|---|---|
| **Mood** | `PEACEFUL · ADVENTUROUS · HOPEFUL · WARM` | Emotional colour — 1–4 tags from a fixed vocabulary of 29 |
| **Energy** | `LOW` / `MEDIUM` / `HIGH` / `EXTREME` | Intensity tier — drives whether a cue fits exploration, drama, or finale |
| **Function** | `Overworld exploration, early-game travel` | Story job — what scene this cue is for |
| **Style Tags** | `fantasy RPG, peaceful forest, acoustic guitar, ...` | The paste-into-Suno prompt that produced (or could re-produce) the cue |

### Mood Vocabulary (29 tags, grouped by family)

```
POSITIVE   HAPPY · JOYFUL · CHEERFUL · HOPEFUL · TRIUMPHANT · PEACEFUL ·
           COMFORTING · WARM · ROMANTIC · WHIMSICAL
NEUTRAL    ADVENTUROUS · MYSTERIOUS · CURIOUS · NOSTALGIC · REFLECTIVE ·
           AWE · MAJESTIC · SPIRITUAL · DISCOVERY
NEGATIVE   SAD · BITTERSWEET · MELANCHOLIC · LONELY · TENSE · DANGEROUS ·
           FEARFUL · DESPAIR · TRAGIC · HAUNTED · SHOCK
```

### Energy Tiers

| Tier | Typical use |
|---|---|
| **LOW** | Ambient, slow, intimate — exploration, towns, tender scenes |
| **MEDIUM** | Steady momentum — adventure travel, standard battles, drama |
| **HIGH** | Driving, urgent — tough fights, hazard zones, boss approach |
| **EXTREME** | Maximum intensity — major bosses, finale, endgame fortress |

---

## The 12 Categories

The bible's category numbering matches the folder layout in `music/`. Each
folder is prefixed with its category number so categories sort in narrative order
(field → towns → dungeons → battle → cutscenes → endings).

| # | Folder | Tracks | Files | Theme |
|---|---|---|---|---|
| 01 | `Field & Overworld/` | 46 | 90 | Wilderness travel, biome themes, day/night variants |
| 02 | `Towns & Settlements/` | 16 | 36 | Villages, cities, harbours, shops |
| 03 | `Sacred, Scholarly & Safe Interiors/` | 13 | 26 | Shrines, monasteries, libraries, towers |
| 04 | `Dungeons & Underground/` | 32 | 64 | Caves, ruins, tombs, lava, dream/spirit realms |
| 05 | `Strongholds & Enemy Camps/` | 17 | 36 | Forts, bandit/orc camps, dragon/demon lairs, finale |
| 06 | `Battle Themes/` | 3 | 8 | Random encounter, hectic fight, boss fight |
| 07 | `Cutscenes — Tender & Warm/` | 11 | 20 | Bonding, romance, reunion, family beats |
| 08 | `Cutscenes — Sorrow & Loss/` | 9 | 18 | Death, funeral, lowest point, kingdom falls |
| 09 | `Cutscenes — Drama & Revelation/` | 6 | 12 | Betrayal, truth-reveals, mysterious figures |
| 10 | `Cutscenes — Hope & Triumph/` | 5 | 10 | Growth, redemption, hope returns, resolve |
| 11 | `Celebrations & Ceremonies/` | 3 | 6 | Victory feast, coronation, wedding |
| 12 | `Endings & Credits/` | 6 | 12 | World-saved, four ending variants, finale |
| | **TOTAL** | **167** | **336** | |

(File counts assume two Suno variants per bible entry. Some entries have 4 files
because Trist regenerated them across different Suno sessions with slightly
different naming.)

---

## Files on Disk

### Folder layout

```
music/
  01 - Field & Overworld/
    001 - Forest (Day) (var 1) [6e381783].mp3
    001 - Forest (Day) (var 2) [1f75c856].mp3
    002 - Forest (Night) (var 1) [...].mp3
    ...
  02 - Towns & Settlements/
    ...
  ...
  12 - Endings & Credits/
    ...
```

### Filename convention

`{bible_id:03d} - {bible_name} (var {n}) [{suno_id8}].mp3`

- **`bible_id`** — 001–167, matches the bible's track number. Lets you sort by
  category, then by narrative position within the category.
- **`bible_name`** — the canonical track name from the bible (not the Suno
  filename, which may have typos like "Caste" or sanitized chars like `_`).
- **`var {n}`** — variant index when multiple Suno generations exist for the
  same bible entry. **All variants of the same name are the same song** —
  different attempts at the same cue. Pick the one you prefer for any given
  use, or shuffle between them.
- **`[suno_id8]`** — first 8 chars of the Suno clip UUID. Lets you trace any
  file back to the Suno workspace for the full UUID lookup.

### Variants are the same song

A "song" in the bible's sense is a *cue* — a specific musical role (e.g.
"Castle Town by day"). Suno's pair-generation creates 2 musical takes per cue,
and a few cues were re-generated across sessions, producing 3 or 4 takes. They
are interchangeable for the cue's purpose; treat them as alternates of one
song, not as different songs.

---

## ID3 Tag Schema

Every MP3 in `music/` is tagged with consistent ID3v2.4 metadata so any music
player (foobar2000, MusicBee, MediaMonkey, etc.) can group and search by
mood/energy/function without leaving the player.

| ID3 Frame | Field | Example |
|---|---|---|
| `TIT2` (Title) | Bible name (no variant suffix) | `Forest (Day)` |
| `TPE1` (Artist) | Suno username | `Tubsiwub` |
| `TPE2` (Album Artist) | `Sansflaire` | `Sansflaire` |
| `TALB` (Album) | Bible category | `01 - Field & Overworld` |
| `TPOS` (Disc) | Category number / 12 | `1/12` |
| `TRCK` (Track) | Bible ID / total in category | `1/46` |
| `TCON` (Genre) | `Fantasy RPG Soundtrack` | `Fantasy RPG Soundtrack` |
| `TXXX:MOOD` | Pipe-separated mood tags | `PEACEFUL\|ADVENTUROUS\|HOPEFUL\|WARM` |
| `TXXX:ENERGY` | Energy tier | `LOW` |
| `TXXX:FUNCTION` | Bible story-function blurb | `Overworld exploration, early-game travel` |
| `TXXX:STYLE_TAGS` | Original Suno style tag string | `fantasy RPG, peaceful forest, acoustic guitar, ...` |
| `TXXX:BIBLE_ID` | Numeric bible ID | `1` |
| `TXXX:VARIANT` | Variant index for this cue | `1` |
| `COMM` (Comment) | Function (so default views show it) | `Overworld exploration, early-game travel` |

`TXXX` is the ID3v2 user-defined-text frame; players that surface custom fields
(foobar2000 with `%MOOD%`, MusicBee custom tags, etc.) can use these directly.

### How to search by mood/energy in a player

Examples of useful queries any tag-aware player can build:

| Query | Use case |
|---|---|
| `MOOD contains SAD AND ENERGY = LOW` | Funeral, graveside reflection beats |
| `MOOD contains DANGEROUS AND ALBUM contains Dungeon` | Boss approach, deep-dungeon dread |
| `MOOD contains HOPEFUL AND ALBUM contains Cutscene` | Tender / triumphant story beats |
| `MOOD contains TRIUMPHANT AND ENERGY = EXTREME` | Climactic boss, finale, true-ending payoff |
| `MOOD contains MYSTERIOUS AND ALBUM contains Field` | Foreboding overworld travel |
| `MOOD contains ROMANTIC` | Three tracks — romance, confession, wedding |

---

## Mood Index (Quick Reference)

Frequencies across the 167 tracks. Useful when picking a search axis: a wide
mood like `MYSTERIOUS` (49 entries) gives a deep playlist; a rare one like
`SHOCK` (2 entries) gives a single dramatic beat.

| Mood | Count | Mood | Count | Mood | Count |
|---|---|---|---|---|---|
| MYSTERIOUS | 49 | TRIUMPHANT | 15 | DESPAIR | 11 |
| AWE | 45 | WHIMSICAL | 15 | SAD | 11 |
| TENSE | 40 | HAUNTED | 14 | MELANCHOLIC | 10 |
| ADVENTUROUS | 33 | MAJESTIC | 13 | COMFORTING | 10 |
| PEACEFUL | 32 | LONELY | 12 | JOYFUL | 10 |
| REFLECTIVE | 30 | CURIOUS | 12 | NOSTALGIC | 10 |
| HOPEFUL | 26 | BITTERSWEET | 12 | TRAGIC | 9 |
| DANGEROUS | 26 | DISCOVERY | 17 | CHEERFUL | 7 |
| WARM | 25 | SPIRITUAL | 16 | ROMANTIC | 3 |
| FEARFUL | 18 | | | SHOCK | 2 |

For the full mood-to-track index, see the "Mood Index" section at the end of
`Soundtrack_Bible.docx` (or query the JSON at `ref/_bible.json`).

---

## Workspace Coverage

As of the most recent sync:

- **167 bible tracks** total
- **336 MP3 files** downloaded from the Suno "Aria Adventure" workspace
- **164 bible tracks** have at least one MP3 in the workspace
- **3 bible tracks** are not yet generated:
  - `032 Tundra (Night)` — *Field & Overworld* — aurora-wonder LOW-energy night cue
  - `036 Oasis (Night)` — *Field & Overworld* — moonlit-oasis LOW-energy rest cue
  - `088 Ancient Ruins (Night)` — *Dungeons & Underground* — moonlit-ruins LOW-energy mystery cue

These three are real gaps. To complete the library, generate them in Suno using
the style-tag strings from the bible JSON (`ref/_bible.json`) and re-run
`ref/suno-download.py` — it's idempotent, will skip everything already on disk,
and pull only the new clips.

---

## Working with the Bible Programmatically

The canonical data lives in `ref/_bible.json`. Schema:

```jsonc
{
  "tracks": [
    {
      "id": 1,
      "name": "Forest (Day)",
      "category": "I. FIELD & OVERWORLD",
      "category_num": 1,
      "mood": ["PEACEFUL", "ADVENTUROUS", "HOPEFUL", "WARM"],
      "energy": "LOW",
      "function": "Overworld exploration, early-game travel",
      "style_tags": "fantasy RPG, peaceful forest, woodland ambiance, ..."
    },
    ...
  ]
}
```

Common one-liners:

```python
import json
b = json.load(open('ref/_bible.json'))['tracks']

# All HIGH-energy dungeon cues
[t for t in b if t['energy'] == 'HIGH' and 'DUNGEONS' in t['category']]

# All tracks tagged ROMANTIC
[t for t in b if 'ROMANTIC' in t['mood']]

# Re-generate the Suno prompt for any cue
next(t for t in b if t['name'] == 'Boss Battle')['style_tags']
```

---

## Adding New Cues

When you generate a new cue in Suno and download it:

1. Decide which bible category it belongs to (or whether the bible needs a new
   entry — currently 167 is exhaustive for fantasy RPG, but you might add e.g.
   a sci-fi extension).
2. Add a new entry to the docx and re-extract the JSON
   (`python ref/parse-bible.py`), OR add it directly to `_bible.json`.
3. Re-run `ref/suno-download.py` to fetch the new MP3.
4. Re-run `ref/organize-music.py` (see below) — it's idempotent: it
   re-matches all files, renames into the right folder, and re-tags ID3.
5. Update this doc's coverage table if a category count changed.
