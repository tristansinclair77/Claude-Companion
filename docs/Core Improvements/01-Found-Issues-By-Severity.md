# Local Brain — Found Issues By Severity

Audit of the 3-tier local brain routing system (`local-brain.js`, `knowledge-db.js`,
`claude-bridge.js`, `template-engine.js`).

---

## HIGH

### 1. Visual trigger learned without screenshot
**File:** `local-brain.js:98-104`

`_learnVisualTrigger()` fires even when no screenshot was actually captured. The code
checks whether the message *would* need a screenshot, then learns the trigger phrase
regardless of whether one was attached. Over time this pollutes the visual trigger
database with non-visual phrases.

### 2. Memory overlap threshold too loose
**File:** `knowledge-db.js:579-585`

The Jaccard threshold for "same topic" detection is 0.25 (25% word overlap). Two
unrelated memories sharing common words (e.g. "like", "love", "food") get treated as
contradictions, causing the old memory to be incorrectly deactivated.

**Example:** "I like ice cream" and "I like spicy food" share "like" — 50% overlap
triggers deactivation of the first memory even though they are different topics.

### 3. Visual trigger confidence ramps too fast
**File:** `knowledge-db.js:497-500`

New triggers start at 0.3 confidence and gain +0.1 per occurrence. Any arbitrary 2-4
word n-gram extracted from user messages can become a high-confidence visual trigger
after just a few interactions, creating widespread false positives.

---

## MEDIUM

### 4. Synonym expansion inflates Jaccard scores
**File:** `local-brain.js:500-515`

In `synonymAwareJaccard()`, the denominator uses only original word counts while the
numerator benefits from synonym expansion matches. This lets scores inflate artificially
— two non-identical queries can hit a perfect 1.0 if they happen to be synonym-rich.

**Example:** "what is your favorite color" vs "do you like this shade" can score 1.0
because "favorite"/"like" and "color"/"shade" are synonyms, but the union size stays
small.

### 5. Knowledge lookup fails on generic queries
**File:** `knowledge-db.js:290-322`

`_hasSpecificTopicMatch()` requires at least one query word that is NOT in the
GENERIC_QUALIFIERS set ("what", "your", "do", "is", "how", etc.). Common question
patterns can have all their meaningful words classified as generic, causing silent
lookup failures and unnecessary fallback to Claude.

### 6. Input intent never stored with learned responses
**File:** `local-brain.js:177-185`

When Claude responses are learned into the `learned_responses` table, the `input_intent`
column is never populated despite existing in the schema (`knowledge-db.js:42`). Future
lookups cannot use intent as a ranking signal, potentially surfacing responses for the
wrong types of questions.

### 7. FTS5 fallback LIKE query is unescaped
**File:** `knowledge-db.js:362-386`

When the FTS5 query fails and falls back to a `LIKE` search, the pattern is not escaped
for `%` and `_` wildcards. Additionally, `pattern.slice(0, 50)` truncates without
word-boundary awareness.

### 8. Fact details can never be cleared
**File:** `knowledge-db.js:240-268`

The update logic uses `factDetail || existing.fact_detail`, which means an empty string
or falsy value from Claude preserves the old (potentially wrong) detail instead of
clearing it. There is no way to remove outdated context from a fact.

### 9. Confidence threshold too low relative to scoring model
**File:** `constants.js:143`, `local-brain.js:401`

`CONFIDENCE_THRESHOLD` is 0.25, but a week-old response with mediocre Jaccard similarity
(0.5) and default confidence (0.5) still scores ~0.5 — well above the threshold. Old,
low-quality matches bypass Claude when they probably shouldn't.

### 10. Temp file leak on Claude CLI timeout
**File:** `claude-bridge.js:183`

The system prompt is written to a temp file. On normal completion, `_cleanup()` removes
it. But the timeout handler kills the process and rejects the promise without calling
`_cleanup()`, leaving orphaned files in the OS temp directory.

### 11. Knowledge vs Learned-Response ranking is order-dependent
**File:** `local-brain.js:112-131`

The routing order is: Filler -> Knowledge Brain -> Learned Response -> Claude. Knowledge
Brain always wins over Learned Responses by call order, not by quality score. A
frequently-used, high-confidence learned response from many prior conversations gets
sidelined by a mediocre knowledge match simply because it's checked first.

---

## LOW

### 12. Template recently-used exhaustion
**File:** `template-engine.js:137-145`

Topics with fewer than 6 unique templates hit the `_recentlyUsed` wall. The relaxation
logic re-adds all templates without deduplication, leading to template fatigue and
recycled responses after repeated questions on the same topic.

### 13. Future timestamps break recency bonus
**File:** `local-brain.js:571-577`

If `last_used_at` is set to a future date (clock skew, data corruption), `daysSince`
becomes negative, which satisfies the `< 1` check and returns the maximum recency bonus
of 1.2 — resurrecting stale responses.

### 14. Memory deduplication is case-sensitive
**File:** `knowledge-db.js:415-432`

The duplicate check uses exact string match: `WHERE category = ? AND content = ?`.
Memories like "I like pizza" and "i like pizza" are stored as separate entries, bloating
the permanent memory database over time.

### 15. No log when falling through to Claude
**File:** `local-brain.js:78-239`

Individual local tiers log their hits, but when a message passes through all tiers and
reaches Claude, there is no summary log entry explaining which tiers were tried and why
they failed. Debugging routing decisions requires checking for the *absence* of other
log lines.
