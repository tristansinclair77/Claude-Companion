# RPG Adventure — Balance Design Document

This document captures all balance decisions, formulas, and design rules for the RPG
sub-game. It is the source of truth for implementation.

---

## 1. Core Philosophy

Power comes from four distinct, non-stacking layers:

| Layer | Role |
|-------|------|
| **Tier** | Sets the power band — exponential macro-jumps |
| **Gear** | Primary vertical driver within a tier |
| **Stats** | Percentage multipliers on weapon output |
| **Level** | Smooth, minor efficiency scaling |

The golden rule: **one multiplicative layer per source.** Stats multiply weapon output
once. Tiers scale gear and enemies. Level scales HP and provides stat points. These
layers do not compound each other directly.

---

## 2. Tier Multipliers

Custom lookup table — not a formula. Index by `Tier - 1`.

```
TierMultipliers = [1.0, 1.5, 3.0, 6.0, 10.0, 15.0, 25.0, 38.0, 54.0, 80.0]
TierMultiplier(tier) = TierMultipliers[tier - 1]
```

| Tier | Multiplier |
|------|------------|
| 1    | 1.0×       |
| 2    | 1.5×       |
| 3    | 3.0×       |
| 4    | 6.0×       |
| 5    | 10.0×      |
| 6    | 15.0×      |
| 7    | 25.0×      |
| 8    | 38.0×      |
| 9    | 54.0×      |
| 10   | 80.0×      |

Jumps are designed to feel exciting at the middle tiers while remaining manageable
in total range (80× from T1 to T10, not 109×).

---

## 3. Player Level Scaling

- **200 levels**, **+3 primary stat points per level**
- Total stat pool at level 200: **600 points**
- Stats allocated freely among STR, AGI, INT, VIT by the player
- Secondary stats (Pierce, Impact, Dodge, Accuracy, Speed, Luck) **cannot** receive
  level-up points — all secondary stats come from gear only

**HP:**
```
MaxHP = BaseHP + (VIT × 8) × (1 + Level × 0.01)
```
The level multiplier applies only to the VIT contribution, keeping HP growth smooth
without inflating the base.

---

## 4. Primary Stats

| Stat | Role |
|------|------|
| **STR** | Melee damage scaling, minor contribution to ranged |
| **AGI** | Ranged damage scaling, minor contribution to melee |
| **INT** | Magic damage scaling |
| **VIT** | Maximum HP |

STR and AGI both contribute to physical damage — the exact split is per-weapon
(see Section 6). INT contributes to magic damage. Some weapons use a mix.

---

## 5. Primary Stat Soft Caps

Piecewise function. Applied before any damage formula. Players can invest past the
thresholds, but marginal returns drop sharply.

```
if Stat ≤ 300:
    EffectiveStat = Stat                           // 100% efficiency (1:1)
elif Stat ≤ 450:
    EffectiveStat = 300 + (Stat - 300) × 0.5      // 50% marginal efficiency
else:
    EffectiveStat = 375 + (Stat - 450) × 0.15     // 15% marginal efficiency
```

Continuous at both thresholds (both sides equal 375 at Stat = 450).

| Raw Stat | Effective | Note |
|----------|-----------|------|
| 100 | 100 | Full return |
| 300 | 300 | Cap 1 — starts diminishing |
| 375 | 337 | Diminished |
| 450 | 375 | Cap 2 — becomes wasteful |
| 500 | 382 | Wasteful |
| 600 | 397 | All 600 level points in one stat |

A player who puts all 600 level points into one stat caps at ~397 effective.
Two stats at 300 each give 600 effective total. Spreading stats is mechanically
rewarded without hard-walling specialists.

---

## 6. Weapon Types & Damage Formula

### Stat Weights

Every weapon carries explicit weights for STR, AGI, and INT that sum to 1.0.
Omitted stats contribute nothing.

```
StatBonus = (STRWeight × EffSTR) + (AGIWeight × EffAGI) + (INTWeight × EffINT)
Damage    = WeaponDamage × (1 + StatBonus / 100)
```

### Example Weapon Profiles

| Weapon | STR | AGI | INT | Notes |
|--------|-----|-----|-----|-------|
| Warhammer | 0.90 | 0.10 | — | Strength-dominant, minor agility |
| Battleaxe | 0.85 | 0.15 | — | |
| Longsword | 0.80 | 0.20 | — | |
| Dagger | 0.40 | 0.60 | — | Agility-dominant, meaningful STR |
| Longbow | 0.40 | 0.60 | — | Ranged, mirrors dagger weights |
| Crossbow | 0.50 | 0.50 | — | Balanced physical |
| Ice Lance | 0.20 | — | 0.80 | Magic-dominant, minor STR |
| Staff | — | — | 1.00 | Pure magic |
| Spellblade | 0.40 | — | 0.60 | Physical-magic hybrid |

These are reference profiles. Individual weapons can have any valid weight
distribution within these archetypes.

### Mixed Weapons

Weapons that have both physical and magic components carry a split damage budget:
```
PhysDmg  = WeaponPhysDamage × (1 + EffPhysStat / 100)
MagicDmg = WeaponMagicDamage × (1 + EffINT / 100)
RawDamage = PhysDmg + MagicDmg
```
Where EffPhysStat = (STRWeight × EffSTR) + (AGIWeight × EffAGI) normalised to
the physical weights only.

---

## 7. Damage Resolution & Armor

After computing raw weapon damage, armor reduces it:

```
DamageAfterDEF  = RawDamage × (1 - TotalDEF)
ActualDamage    = max(1, DamageAfterDEF - TotalARM)
```

- **DEF** — percentage damage reduction. Sourced from armor pieces only.
  No soft cap; kept under control by gear budget design (best-in-slot stacking
  should peak around 55–65% naturally).
- **ARM** — flat damage reduction. Small relative to zone damage, but noticeable.
  Provides consistent chip protection.

Both are always present on armor pieces. See Section 10 for slot rules.

---

## 8. Secondary Stats

All secondary stats come **exclusively from gear**. Players cannot allocate points
to them. Items have a secondary budget separate from their primary budget.

```
SecondaryBudget = PrimaryBudget × RandomUniform(0.50, 0.67)
```

| Stat | Old Name | Role |
|------|----------|------|
| **Pierce** | Crit Chance | Chance to crit |
| **Impact** | Crit Damage | Crit damage multiplier |
| **Dodge** | Dodge | Chance to evade an incoming hit |
| **Accuracy** | Accuracy | Improves hit rate above base |
| **Speed** | Speed | Turn order priority |
| **Luck** | Luck | Rarity, gold, and XP bonuses |

### Accuracy & Dodge

All characters have inherent base stats before gear:
- **Base Accuracy: 70%** — can be improved up to 100% (hard cap)
- **Base Dodge: 2%** — can be improved up to ~50% (soft asymptote)

```
FinalAccuracy = clamp(0.70 + AccuracyStat × 0.001, 0.70, 1.00)
// 300 Accuracy stat → 100% cap (linear, hard clamp)

FinalDodge = 0.02 + 0.48 × (DodgeStat / (DodgeStat + 200))
// Asymptotically approaches 50%, never reaches it
// 200 Dodge → ~26%  |  400 Dodge → ~34%  |  800 Dodge → ~42%
```

**Hit resolution** (multiplicative — never goes negative):
```
HitChance = FinalAccuracy × (1 - FinalDodge)
// Base vs base:         0.70 × 0.98 = 68.6%
// Max acc vs max dodge: 1.00 × 0.50 = 50.0%
```

### Pierce & Impact

```
PierceChance     = Pierce / (Pierce + 400)
// 400 Pierce → 50% crit chance

ImpactMultiplier = 1.5 + (Impact / 500)
// 250 Impact → 2.0× (200% crit damage)
// Keep capped around 3.0× max in practice via gear budget limits
```

### Speed

```
TurnScore = Speed + Random(0, 20)
// Higher score acts first. Randomness prevents deterministic turn order.
```

### Luck

Luck has no combat effect. It is a luxury stat that trades combat efficiency for
long-term reward quality.

```
RarityBonus = 1 + (Luck × 0.003)   // 200 Luck → +60% rarity weight
GoldBonus   = 1 + (Luck × 0.002)   // 200 Luck → +40% gold
XPBonus     = 1 + (Luck × 0.001)   // 200 Luck → +20% XP
```

Choosing gear with Luck over Pierce/Impact is a deliberate build archetype: lower
combat power, higher chance at rare drops and faster levelling.

---

## 9. Companion (CHA) Assist System

CHA is a primary stat but cannot be invested in directly during levelling — it
is sourced from gear only (treated similarly to secondary stats in that regard,
but uses the primary stat soft cap formula).

```
EffectiveCHA  = SoftCap(CHA)   // uses the piecewise formula from Section 5

AssistChance  = EffectiveCHA / (EffectiveCHA + 150)
AssistDamage  = PlayerWeaponDamage × 0.5 × (1 + EffectiveCHA / 200)
```

The companion is meaningful but secondary. A full CHA investment produces a
noticeable assist rate and damage contribution without outpacing the player's
own output.

---

## 10. Gear Slots & Identity

### Slot Rules

| Slot | Primary Stats | Secondary Stats | Tertiary |
|------|--------------|-----------------|----------|
| **Weapon** | *(none on item — scales off player primaries via weights)* | ANY | — |
| **Chest** | STR / AGI / INT / VIT | ANY | Always DEF + ARM |
| **Head** | STR / AGI / INT / VIT | Dodge, Luck, Impact only | Always DEF + ARM |
| **Legs** | STR / AGI / INT / VIT | Dodge, Luck, Impact only | Always DEF + ARM |
| **Hands** | STR / AGI / INT / VIT | Pierce, Accuracy, Speed only | Always DEF + ARM |
| **Feet** | STR / AGI / INT / VIT | Pierce, Accuracy, Speed only | Always DEF + ARM |
| **Ring** | — | ANY — **Speed + Luck biased** | — |
| **Amulet** | — | ANY — **Pierce + Impact biased** | — |
| **Belt** | — | ANY — **Dodge + Accuracy biased** | — |
| **Trinket** | Guaranteed one random primary or secondary stat boost | — | — |

### Stat Budget Formula

```
PrimaryBudget   = BaseBudget × TierMultiplier(tier) × SlotModifier
SecondaryBudget = PrimaryBudget × RandomUniform(0.50, 0.67)
```

Slot modifiers:

| Slot | Modifier |
|------|----------|
| Weapon | 2.5 |
| Chest | 1.5 |
| Head / Legs | 1.2 |
| Hands / Feet / Belt | 1.0 |
| Ring / Amulet | 0.8 |
| Trinket | 0.6 |

Weapons use their budget entirely for WeaponDamage scaling — the secondary budget
rolls secondary stats on top. Armor pieces have their tertiary (DEF/ARM) values
sourced separately (see below).

### Stat Roll Count

- Primary stats: rolls 2–4 stats from the primary pool available to that slot
- Secondary stats: rolls 1–3 stats from the secondary pool available to that slot
- Budget is distributed proportionally across rolled stats

---

## 11. Gear Bias System

Biased slots (Ring/Amulet/Belt) favour certain secondary stats in two ways:
**probability** (more likely to appear) and **magnitude** (larger budget share
when they do appear).

```
BiasWeight[stat] = 2.0   // if stat is biased for this slot
BiasWeight[stat] = 1.0   // otherwise

// Budget share for each rolled stat:
StatShare[stat]  = BiasWeight[stat] / sum(BiasWeight[allRolledStats])
StatValue[stat]  = StatShare[stat] × SecondaryBudget
```

**Example — Speed Ring rolls Speed + Pierce:**
- Speed (biased 2.0): 2/3 = **66.7%** of budget → high Speed value
- Pierce (not biased 1.0): 1/3 = **33.3%** of budget → modest Pierce value

**Example — Speed Ring rolls Speed + Luck (both biased):**
- Each gets 50% — both land at strong values

**Example — Speed Ring rolls Pierce + Accuracy (neither biased):**
- Each gets 50% — both land at moderate values; this ring is "wasted"

Bias weights apply at the roll-probability stage too, making off-bias rolls rarer.

### Natural Build Tensions

The slot-secondary restrictions create real trade-offs:

- **Crit build** needs Amulet (Pierce+Impact), Hands/Feet (Pierce/Speed/Accuracy),
  Head/Legs (Impact/Dodge/Luck). Head/Legs are shared with Dodge builds.
- **Dodge build** needs Head/Legs + Belt. Conflicts with Impact on the same slots.
- **Speed build** needs Hands/Feet + Ring. Conflicts with Pierce on Hands/Feet.
- **Luck build** needs Ring + Head/Legs. Sacrifices crit or dodge.

These are mutually exclusive enough to create meaningful gear decisions without
locking players into rigid templates.

---

## 12. Tertiary Stats — DEF & ARM

DEF and ARM are always present on all five armor slots (Chest, Head, Legs, Hands,
Feet). They do NOT roll from the primary or secondary budget — they have their own
fixed tier-scaled range.

```
DEF = TierBaseDEF × RandomUniform(0.80, 1.00)
ARM = TierBaseARM × RandomUniform(0.80, 1.00)
```

No soft cap on DEF. The hard ceiling is enforced by gear design: even stacking
all five best-in-slot armor pieces should peak around 55–65% DEF naturally.

### Sacrifice Variants (Common Quality Only)

On common-rarity armor pieces, there is a 15% chance the item rolls as a sacrifice
variant. It trades primary and secondary budget for above-normal DEF and ARM.

```
if rarity == COMMON and Random() < 0.15:
    sacrificeRatio    = RandomUniform(0.20, 0.40)
    primaryBudget    *= (1 - sacrificeRatio)
    secondaryBudget  *= (1 - sacrificeRatio)
    DEF = TierBaseDEF × RandomUniform(1.15, 1.40)   // above normal max
    ARM = TierBaseARM × RandomUniform(1.15, 1.40)
```

Sacrifice variants are visually obvious on the loot screen: minimal primary and
secondary stats, notably high DEF/ARM. They are a short-term survival option,
not an optimisation target. Uncommon and above never roll as sacrifice variants.

Sacrifice variants apply to the five armor slots only (Chest, Head, Legs, Hands,
Feet). Accessory slots have no tertiary stats and cannot sacrifice.

---

## 13. Enemy Scaling

```
EnemyHP     = BaseHP     × ZonePower
EnemyDamage = BaseDamage × ZonePower
ZonePower   = TierMultiplier(tier) × ZoneDifficulty

ZoneDifficulty = 0.8 to 1.2   // variance within a tier
```

Enemies scale at 90% of the expected player output for that zone:
```
EnemyPower = ZonePower × 0.9
```

Enemies also have a secondary stat pool (same 50–67% of primary budget rule)
distributed across their own Pierce, Impact, Dodge, Accuracy, Speed values.

### Enemy Accuracy Baseline

All enemies have a guaranteed minimum Accuracy regardless of secondary stat rolls,
so player Dodge gear never reaches 100% effectiveness against basic enemies:

```
EnemyEffectiveAccuracy = EnemyBaseAccuracy + EnemySecondaryAccuracy
```

`EnemyBaseAccuracy` is a small fixed value per zone/tier (not from the secondary
pool). This prevents trivially achieving near-100% dodge.

---

## 14. Zone Power Score (Recommended Power)

Used to display Easy / Balanced / Dangerous indicators and to gate rewards.

```
// Determine primary offensive stat from equipped weapon weights
WeightedStat  = (STRWeight × EffSTR) + (AGIWeight × EffAGI) + (INTWeight × EffINT)
OffenseScore  = WeaponDamage × (1 + WeightedStat / 100)

DefenseScore  = MaxHP × (1 + EffVIT / 200)
PlayerPower   = sqrt(OffenseScore × DefenseScore)

ZoneRecommendedPower = ZonePower   // directly from enemy scaling

PowerRatio = PlayerPower / ZoneRecommendedPower
```

Display thresholds:
- `PowerRatio > 1.25` → Easy
- `0.85 ≤ PowerRatio ≤ 1.25` → Balanced
- `PowerRatio < 0.85` → Dangerous

---

## 15. XP & Gold Rewards

Rewards have a hard floor that moves with the player. Farming content below the
floor yields nothing. Killing above the player's power yields a bonus.

```
RewardRatio      = ZonePower / PlayerPower
Floor            = 0.5   // zones at less than 50% of player power → zero

if RewardRatio < Floor:
    XP   = 0
    Gold = 0
else:
    RewardMultiplier = clamp(RewardRatio, Floor, 1.5)
    XP   = BaseXP   × ZonePower × RewardMultiplier
    Gold = BaseGold × ZonePower × RewardMultiplier
```

- Below 50% of player power: **nothing**
- At player power level: normal rewards (1.0×)
- Above player power (up to 50% stronger): up to **1.5× bonus**

Level curve (XP to next level):
```
XPToLevel = 50 × Level^1.5
```

---

## 16. Zone Stat Drop Bias

Zones bias which secondary stats appear more frequently on gear drops. This is
implemented as a weighted roll modifier on the stat selection table, not as enemy
resistances or separate damage types (those add complexity without enough payoff).

Example bias profiles:

| Zone Type | Biased Stats |
|-----------|-------------|
| Forest | Dodge, Luck |
| Ruins | Impact, Pierce |
| Warfield | Speed, Accuracy |
| Dungeon | Pierce, Impact |
| Tundra | Dodge, Speed |

Bias makes a zone feel like it rewards a particular playstyle without mechanically
forcing it. A Dodge player farming forests finds gear that fits their build
naturally.

---

## 17. Gear Rarity

Rarity is not fully defined yet but influences:
- Number of primary stat rolls (more rolls at higher rarity)
- Number of secondary stat rolls
- Budget roll variance (higher rarity rolls closer to budget ceiling)
- Sacrifice variant eligibility (Common only — see Section 12)

Player Luck (from gear) shifts the weighted rarity table toward higher tiers:
```
RarityBonus = 1 + (Luck × 0.003)   // applied as a weight multiplier on high-rarity outcomes
```

---

*Last updated: Session establishing full balance framework.*
*Next: Implement these formulas in rpg-constants.js and rpg-engine.js.*
