# Claude Companion — AI Learning System

## Overview

The Claude Companion uses a **hybrid intelligence architecture** with three layers:

1. **Cloud AI** (Claude via CLI) — The deep thinker. Handles novel situations, complex reasoning, creative tasks. Uses your Max plan.
2. **Pre-trained ML models** (downloaded once, run locally forever) — The understanding layer. Gives the local brain the ability to understand *meaning*, not just keywords. Detects emotions, classifies intent, and measures semantic similarity.
3. **Custom-trained micro-models** (trained from scratch on YOUR data, on your machine) — The personal layer. Tiny neural networks that learn YOUR patterns, YOUR emotions, YOUR communication style. They start empty and grow with every conversation.

Together, these three layers form a brain that gets smarter, faster, and more personal over time — while always having Claude as a safety net.

---

## Architecture: The Full Brain

```
User Message
     │
     ▼
┌──────────────────────────────────────────────────────┐
│                  UNDERSTANDING LAYER                  │
│          (Pre-trained models, downloaded once)         │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ Sentence Encoder │  │ Base Emotion Classifier  │   │
│  │ (MiniLM, ~80MB) │  │ (~30MB, general emotion) │   │
│  │ Text → 384-dim   │  │ Text → emotion + intensity│  │
│  │ vector           │  │                          │   │
│  └────────┬────────┘  └────────────┬─────────────┘   │
│           │                        │                  │
└───────────┼────────────────────────┼──────────────────┘
            │                        │
            ▼                        ▼
┌──────────────────────────────────────────────────────┐
│                   PERSONAL LAYER                      │
│      (Custom micro-models, trained on YOUR data)      │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ Response Ranker  │  │ Personal Emotion Model   │   │
│  │ (trained from    │  │ (trained from your       │   │
│  │  scratch, ~50KB) │  │  emotion picks, ~20KB)   │   │
│  │ "How well does   │  │ "What is THIS user      │   │
│  │  this stored     │  │  feeling right now?"     │   │
│  │  response fit?"  │  │                          │   │
│  └────────┬────────┘  └────────────┬─────────────┘   │
│           │                        │                  │
└───────────┼────────────────────────┼──────────────────┘
            │                        │
            ▼                        ▼
┌──────────────────────────────────────────────────────┐
│                    BRAIN ROUTER                       │
│                                                      │
│  Input vector + emotion + intent + ranker score       │
│           │                                          │
│           ├── Filler match? ──────▶ Tier 1 (instant) │
│           ├── Ranker score high? ─▶ Tier 2 (local)   │
│           └── Otherwise ──────────▶ Tier 3 (Claude)  │
│                                          │           │
│                              Store response ──▶ DB   │
│                              Retrain micro-models     │
└──────────────────────────────────────────────────────┘
```

---

## The Three Response Tiers

Every user message passes through three tiers in order. The first tier that can handle it wins.

### Tier 1: Filler Responses (instant, no learning)
- **What:** Pre-written reactions for trivial inputs ("hi", "lol", "ok", "?")
- **Source:** `filler-responses.json` in the character pack
- **Speed:** Instant (0ms, no computation)
- **Learning:** None. These are static. They never change from interaction.
- **Purpose:** Makes the companion feel alive and responsive for simple social exchanges that don't need any real intelligence.

### Tier 2: Local Brain (fast, learned from past interactions)
- **What:** Responses retrieved from the knowledge database, ranked by the custom-trained Response Ranker neural network
- **Source:** `knowledge.db` (SQLite) + Response Ranker model + Sentence Encoder
- **Speed:** Fast (<200ms — embedding + DB query + neural ranking)
- **Learning:** YES. Both the knowledge DB and the Response Ranker improve with every interaction.
- **Purpose:** Handle conversations the companion has "seen before" without using Claude tokens.

### Tier 3: Claude CLI (slow, always accurate)
- **What:** Full Claude response via `claude -p` command
- **Source:** Claude Code CLI → Max plan
- **Speed:** Slow (2-15 seconds depending on response length)
- **Learning:** Every Claude response gets stored in the knowledge DB AND used to retrain the micro-models.
- **Purpose:** Handle anything the local brain can't — novel questions, complex reasoning, creative tasks.

---

## Layer 1: Pre-Trained Models (Downloaded Once)

These are models trained by researchers on massive datasets. We download them once (~110MB total), and they run locally forever with no internet needed. They provide general language understanding that our custom models build on top of.

### Sentence Encoder: `all-MiniLM-L6-v2`

- **Size:** ~80MB (quantized)
- **What it does:** Converts any text into a 384-dimensional vector (an array of 384 numbers). Texts with similar meaning produce similar vectors, even if they use completely different words.
- **Why we need it:** This is what makes "I'm feeling down" match "I'm sad" — keyword matching can't do this. Every user message and every stored response gets converted to a vector. Matching is done by cosine similarity between vectors instead of keyword overlap.
- **Technology:** Transformer neural network (6 layers, 22M parameters), runs via `@xenova/transformers` (ONNX Runtime in JavaScript/WebAssembly).
- **When it runs:** Every time the user sends a message (to encode it) and once when each new response is stored (to pre-compute its vector).

**How vectors work conceptually:**
```
"I'm feeling down"      → [0.12, -0.45, 0.78, 0.33, ...]  (384 numbers)
"I'm sad"               → [0.11, -0.43, 0.76, 0.35, ...]  (very similar!)
"What's for dinner?"    → [0.89, 0.22, -0.15, 0.67, ...]  (very different)

cosine_similarity("I'm feeling down", "I'm sad") = 0.94  (high match!)
cosine_similarity("I'm feeling down", "What's for dinner?") = 0.12  (no match)
```

### Base Emotion Classifier: `SamLowe/roberta-base-go_emotions`

- **Size:** ~30MB (quantized)
- **What it does:** Takes text and outputs probabilities for 28 emotion categories (admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral).
- **Why we need it:** Provides a baseline emotion detection that works from day one, before the personal emotion model has enough data to be useful. We map its 28 categories to our 19 companion emotions.
- **When it runs:** Every user message, to detect emotion. The personal emotion model's output is blended with this as it gains confidence.

---

## Layer 2: Custom-Trained Micro-Models (Built From Scratch)

These are tiny neural networks — just a few layers, a few thousand parameters — that we define, initialize, and train entirely on YOUR machine using YOUR conversation data. They start knowing nothing and gradually become experts on YOU specifically.

**Technology:** We implement these in pure JavaScript using a lightweight tensor library (`onnxruntime-node` for inference, custom training loops or `brain.js` for the simple networks). No Python, no heavy frameworks — they run inside the Electron app.

### Micro-Model 1: Response Ranker

**Purpose:** Given a user message and a candidate stored response, output a score (0.0–1.0) representing how good a fit this response is. Replaces the formula-based scoring (Jaccard × confidence × recency) with a learned function that captures patterns a formula never could.

**Architecture:**
```
Input:  [user_message_vector (384)] + [stored_response_vector (384)] + [metadata (8)]
        ────────────────────────────────────────────────────────────────────────────
                                          │
                                  Concatenate (776)
                                          │
                                    Dense(776 → 128, ReLU)
                                          │
                                    Dropout(0.2)
                                          │
                                    Dense(128 → 32, ReLU)
                                          │
                                    Dense(32 → 1, Sigmoid)
                                          │
                                    Output: score (0.0–1.0)
```

**The metadata features (8 values):**
1. Cosine similarity between user and stored vectors (pre-computed)
2. Stored response confidence value
3. Days since response was last used (normalized)
4. Response use count (normalized)
5. User's current detected emotion (one-hot encoded to a single float based on valence)
6. Stored response emotion match (0 or 1)
7. Message length ratio (user message length / stored message length)
8. Time of day similarity (were both messages sent at similar hours?)

**Training data:** Every interaction produces a training example:
- **Positive example (label=1.0):** The response that was actually used AND the user reacted positively
- **Negative examples (label=0.0):** Other candidate responses from the DB that were NOT selected, or responses that got negative feedback
- **Soft labels (0.3–0.7):** Responses that were used but got ambiguous feedback

**Training schedule:**
- After every 10 Claude responses (enough new data to be meaningful)
- Full retrain on all historical data (not incremental — the model is tiny enough to retrain in <1 second)
- Training happens in a background thread, doesn't block the UI

**Parameter count:** ~102,000 parameters × 4 bytes = ~400KB model file. Trains in <1 second on CPU.

**How it replaces the old formula:**

Before (v1 formula):
```
score = keyword_similarity × confidence × recency_bonus × emotion_match_bonus
```
This is rigid — it can't learn that, for this specific user, emotion match matters way more than recency. Or that short responses work better in the morning.

After (Response Ranker neural net):
```
score = ResponseRanker(user_vector, response_vector, metadata)
```
The network LEARNS the optimal weighting from real feedback. It discovers patterns we'd never hardcode.

### Micro-Model 2: Personal Emotion Classifier

**Purpose:** Detect the user's emotional state from their text, personalized to how THIS specific user expresses emotions (not how people express emotions in general).

**Architecture:**
```
Input:  [user_message_vector (384)]
        ──────────────────────────
                    │
              Dense(384 → 64, ReLU)
                    │
              Dropout(0.3)
                    │
              Dense(64 → 19, Softmax)
                    │
              Output: probability for each of our 19 emotions
```

**Training data:** Every time the user explicitly picks an emotion from the Emotion picker, that's a perfect training example — ground truth of what they were feeling paired with what they typed. The base emotion classifier's output is also used as soft labels when the user doesn't explicitly pick.

**Blending with the base model:**

```
personal_weight = min(training_examples / 200, 0.8)  // grows from 0 to 0.8
base_weight = 1.0 - personal_weight

final_emotion = (personal_model_output × personal_weight) + (base_model_output × base_weight)
```

- With 0 training examples: 100% base model (the pre-trained one)
- With 100 examples: 50/50 blend
- With 200+ examples: 80% personal, 20% base (base always has a voice as a safety net)

**Parameter count:** ~26,000 parameters × 4 bytes = ~100KB model file. Trains in <0.5 seconds on CPU.

**What it learns that the base model can't:**
- The base model knows that "ugh" generally means frustration
- The personal model learns that when THIS user says "ugh" followed by code terms, they're frustrated, but when they say "ugh" followed by "tired", they're exhausted
- The base model treats all users the same; the personal model is a specialist in one person

### Micro-Model 3: Intent Classifier (optional, Phase 2)

**Purpose:** Categorize what the user is trying to do: ask a question, give a command, express an emotion, make small talk, request creative content, share information, etc.

**Architecture:**
```
Input:  [user_message_vector (384)]
        ──────────────────────────
                    │
              Dense(384 → 32, ReLU)
                    │
              Dense(32 → 8, Softmax)
                    │
              Output: probability for each intent category
```

**Intent categories:**
1. `question` — Asking for information or help
2. `command` — Direct instruction ("do this", "show me")
3. `emotion_share` — Expressing how they feel
4. `small_talk` — Casual chat, greetings, banter
5. `creative_request` — Asking for something to be made/written
6. `information_share` — Telling the companion something (context, updates)
7. `correction` — Disagreeing with or correcting the companion
8. `visual_request` — Wanting the companion to see something

**How the brain router uses intent:**
- `small_talk` → heavily favor Tier 1 (fillers) and Tier 2 (local brain)
- `question` about known topics → Tier 2 if confident, else Tier 3
- `creative_request` → always Tier 3 (Claude). Local brain can't create novel content.
- `correction` → mark previous local response as negative feedback, route to Tier 3
- `visual_request` → auto-trigger screen capture

**Parameter count:** ~13,000 parameters. ~50KB. Trains in <0.3 seconds.

**Training data:** Intent labels are inferred from what happens AFTER the message:
- If the companion answered a question and user was satisfied → label as `question`
- If the user clicked the Screen button → label as `visual_request`
- If the user picked an emotion → label as `emotion_share`
- Filler trigger matches → label as `small_talk`
- These are noisy labels, but with enough data the model converges

---

## The Knowledge Database (Enhanced)

The knowledge DB stores everything the brain needs. With the ML layer, each entry now includes pre-computed vectors.

```sql
CREATE TABLE learned_responses (
  id INTEGER PRIMARY KEY,

  -- Original text
  input_text TEXT,                    -- raw user input
  input_pattern TEXT,                 -- normalized (lowercase, no punctuation)

  -- Pre-computed ML features (stored as BLOBs for speed)
  input_vector BLOB,                 -- 384-dim float32 vector from Sentence Encoder
  response_vector BLOB,              -- 384-dim float32 vector of the response

  -- Structured response
  response_dialogue TEXT,
  response_thoughts TEXT,
  response_emotion TEXT,

  -- Metadata
  input_emotion TEXT,                 -- detected/stated user emotion
  input_intent TEXT,                  -- classified intent
  prior_context_vector BLOB,         -- vector of the previous 1-2 messages (for context)
  confidence REAL DEFAULT 0.5,
  use_count INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'claude',
  is_core_knowledge BOOLEAN DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME
);

-- Vector similarity search index (approximate nearest neighbors)
-- We store vectors as BLOBs and compute cosine similarity in JS
-- For <10K entries this is fast enough without a dedicated vector DB

CREATE TABLE user_profile (
  key TEXT PRIMARY KEY,
  value TEXT,                         -- JSON-encoded
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visual_triggers (
  id INTEGER PRIMARY KEY,
  phrase TEXT UNIQUE,
  confidence REAL DEFAULT 0.3,
  trigger_count INTEGER DEFAULT 1,
  false_positive_count INTEGER DEFAULT 0,
  created_at DATETIME,
  last_triggered_at DATETIME
);

CREATE TABLE training_log (
  id INTEGER PRIMARY KEY,
  model_name TEXT,                    -- 'response_ranker', 'emotion_classifier', 'intent_classifier'
  training_examples INTEGER,
  loss REAL,                          -- training loss (lower = better)
  accuracy REAL,                      -- validation accuracy
  trained_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emotion_lexicon (
  id INTEGER PRIMARY KEY,
  word_or_phrase TEXT,
  emotion TEXT,
  confidence REAL DEFAULT 0.5,
  source TEXT DEFAULT 'seed',         -- 'seed', 'user_explicit', 'claude_detected'
  times_confirmed INTEGER DEFAULT 0
);
```

---

## The Complete Learning Pipeline

Here's exactly what happens for every single user message, step by step:

### When the User Sends a Message

```
1. ENCODE
   └─ Sentence Encoder converts message to 384-dim vector
   └─ ~50ms

2. CLASSIFY
   ├─ Base Emotion Model: detects emotion from text (general)
   ├─ Personal Emotion Model: detects emotion from text (personalized)
   ├─ Blend outputs based on personal model maturity
   ├─ Intent Classifier: determines what user is trying to do
   └─ ~30ms total (all three run in parallel on the same vector)

3. CHECK SCREEN TRIGGERS
   ├─ Compare message against visual trigger phrases
   ├─ If matched: auto-capture screenshot, attach to message
   └─ ~5ms

4. CHECK FILLERS
   ├─ Compare normalized message against filler triggers
   ├─ If exact match: return filler response immediately
   ├─ Tag source as "filler"
   └─ ~1ms

5. SEARCH KNOWLEDGE DB
   ├─ Query DB for top 20 candidates by FTS5 keyword match
   ├─ For each candidate: compute cosine similarity between input vector and stored vector
   ├─ Filter to top 5 by cosine similarity
   └─ ~20ms

6. RANK CANDIDATES (Neural)
   ├─ For each of the top 5 candidates:
   │   ├─ Build feature vector: [input_vec, response_vec, metadata]
   │   ├─ Run through Response Ranker neural network
   │   └─ Get score (0.0–1.0)
   ├─ Select highest-scoring candidate
   └─ ~10ms

7. DECIDE
   ├─ If best score ≥ threshold (0.75): return local response, tag source as "local"
   ├─ If best score < threshold: send to Claude CLI
   │   ├─ Include: message, emotion context, user profile summary, prior context
   │   ├─ Wait for response (2-15 seconds)
   │   ├─ Parse [DIALOGUE] / [THOUGHTS] / emotion
   │   ├─ Tag source as "claude"
   │   └─ Store response in knowledge DB with pre-computed vectors
   └─ Decision: ~1ms

Total local path: ~120ms
Total Claude path: 2-15 seconds + 120ms
```

### After the Response Is Displayed

```
8. WATCH FOR FEEDBACK (next 1-3 user messages)
   ├─ Positive signals: natural continuation, acknowledgment, positive emotion
   ├─ Negative signals: correction, re-ask, negative emotion, "ask Claude"
   ├─ Update confidence on the response that was used
   ├─ Generate training examples for the Response Ranker:
   │   ├─ Positive example: (input, chosen_response, feedback_label=positive)
   │   └─ Negative examples: (input, other_candidates, label=negative)
   └─ Store in training buffer

9. RETRAIN MICRO-MODELS (every 10 new training examples)
   ├─ Response Ranker: full retrain on all historical examples (~0.5-1s)
   ├─ Personal Emotion Model: full retrain on all emotion-labeled examples (~0.3s)
   ├─ Intent Classifier: full retrain on all intent-labeled examples (~0.2s)
   ├─ Log training metrics to training_log table
   └─ Runs in background, non-blocking
```

---

## How the Micro-Models Are Trained (Technical Detail)

Since we're building these from scratch, here's exactly how training works inside the Electron app.

### Implementation: `src/main/neural/`

```
src/main/neural/
├── tensor.js           -- Minimal tensor operations (matmul, add, relu, softmax, sigmoid)
├── model.js            -- Neural network class (forward pass, backward pass, weight updates)
├── response-ranker.js  -- Response Ranker architecture + training loop
├── emotion-model.js    -- Personal Emotion Classifier architecture + training loop
├── intent-model.js     -- Intent Classifier architecture + training loop
├── trainer.js          -- Background training scheduler
└── models/             -- Saved model weights (JSON files)
    ├── response-ranker-weights.json
    ├── emotion-model-weights.json
    └── intent-model-weights.json
```

### The Training Loop (same for all three models)

```javascript
// Pseudocode for how training works

class MicroModel {
    constructor(layerSizes) {
        // Initialize weights randomly (Xavier initialization)
        this.weights = [];
        this.biases = [];
        for (let i = 0; i < layerSizes.length - 1; i++) {
            this.weights.push(randomMatrix(layerSizes[i], layerSizes[i+1]));
            this.biases.push(zeroVector(layerSizes[i+1]));
        }
    }

    forward(input) {
        // Pass input through each layer
        let activation = input;
        for (let i = 0; i < this.weights.length; i++) {
            activation = matmul(activation, this.weights[i]);
            activation = add(activation, this.biases[i]);
            if (i < this.weights.length - 1) {
                activation = relu(activation);      // Hidden layers: ReLU
            } else {
                activation = sigmoid(activation);   // Output: Sigmoid (for ranker)
                // or softmax(activation)            // Output: Softmax (for classifiers)
            }
        }
        return activation;
    }

    train(trainingData, epochs, learningRate) {
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;

            for (const { input, label } of trainingData) {
                // Forward pass
                const prediction = this.forward(input);

                // Compute loss (MSE for ranker, cross-entropy for classifiers)
                const loss = computeLoss(prediction, label);
                totalLoss += loss;

                // Backward pass (backpropagation)
                const gradients = this.backward(input, prediction, label);

                // Update weights (SGD with momentum)
                for (let i = 0; i < this.weights.length; i++) {
                    this.weights[i] = subtract(this.weights[i],
                        scale(gradients.weights[i], learningRate));
                    this.biases[i] = subtract(this.biases[i],
                        scale(gradients.biases[i], learningRate));
                }
            }
        }
    }

    save(filepath) {
        // Serialize weights/biases to JSON
    }

    load(filepath) {
        // Deserialize weights/biases from JSON
    }
}
```

**Key details:**
- **Backpropagation** is implemented from scratch in `tensor.js` — computing gradients for each layer by applying the chain rule backwards through the network
- **Optimization:** Stochastic Gradient Descent (SGD) with momentum (0.9). Simple, stable, well-suited for tiny models
- **Learning rate:** 0.01 initially, decayed by 0.95 each retrain cycle
- **Epochs per retrain:** 50 (model is tiny, data is small, this is fast)
- **Overfitting prevention:** Dropout during training (0.2-0.3), plus the model is deliberately small so it can't memorize noise
- **Weight saving:** After every retrain, weights are saved to JSON files in the character pack directory. On app startup, weights are loaded from these files. If no weights exist, the model initializes randomly.

### Training Data Sizes Needed

| Model | Minimum Useful Data | Good Performance | Excellent |
|-------|-------------------|-----------------|-----------|
| Response Ranker | ~50 labeled interactions | ~200 interactions | ~500+ |
| Personal Emotion | ~30 explicit emotion picks | ~100 emotion picks | ~200+ |
| Intent Classifier | ~40 intent-labeled messages | ~150 messages | ~300+ |

Before the minimum threshold, the model outputs are ignored and the system falls back to the formula-based approach (v1 behavior). The transition is gradual — model output is blended with formula output based on training data count.

---

## Reinforcement: How the Brain Learns What Works

### Confidence System (Same as Before, But Feeding Neural Training)

Every response still has a confidence score (0.0–1.0) that goes up and down based on feedback. This hasn't changed. But now, confidence changes ALSO generate training data for the Response Ranker.

| Event | Confidence Change | Training Signal |
|-------|----------|-----------|
| New Claude response stored | Set to 0.50 | (stored, no training signal yet) |
| User continues naturally after local response | +0.05 | Positive example for Ranker |
| User sends positive acknowledgment | +0.05 | Positive example for Ranker |
| User sends positive emotion after response | +0.05 | Positive example for Ranker + Emotion training example |
| Conversation continues 2+ turns without issue | +0.03 | Weak positive example (label=0.7) |
| User corrects or disagrees | -0.10 | Negative example for Ranker |
| User re-asks the same question | -0.10 | Negative example for Ranker |
| User sends negative emotion after response | -0.07 | Negative example for Ranker + Emotion training example |
| User abruptly changes topic | -0.03 | Weak negative example (label=0.3) |
| Stale entry (no use in 30+ days) | -0.02/month | No training signal (time-based, not feedback-based) |
| High-use promotion (use_count > 10, conf > 0.9) | Floor set to 0.70 | Multiple positive examples reinforced |

### The Feedback Window

After a response is displayed, the system watches the next 1-3 user messages for feedback signals:

```
Response displayed
     │
     ├── Next message within 5 seconds?
     │   ├── Contains correction words ("no", "wrong", "not what I meant") → NEGATIVE
     │   ├── Contains acknowledgment ("ok", "thanks", "cool") → POSITIVE
     │   ├── Contains a question mark (re-asking?) → check similarity to original → NEGATIVE if similar
     │   └── None of the above → NEUTRAL (wait for more signals)
     │
     ├── Next message within 30 seconds?
     │   ├── Emotion picker used → read emotion → POSITIVE if positive, NEGATIVE if confused/angry
     │   ├── Normal conversation continues → POSITIVE (implicit approval)
     │   └── Topic changes abruptly → WEAK NEGATIVE
     │
     └── No message within 2 minutes?
         └── NEUTRAL (user left, no signal)
```

---

## User Profile Learning

Beyond individual responses, the local brain builds a **user profile** — a persistent model of who the user is and how they communicate.

### What It Tracks

| Profile Key | What It Learns | How It's Used |
|-------------|---------------|---------------|
| `communication_style` | Formal vs casual, verbose vs terse, uses slang? | Adjusts system prompt hints for Claude |
| `average_message_length` | Typical word count | Helps distinguish "short = acknowledgment" from "short = upset" |
| `common_topics` | Frequency map of discussed topics | Biases keyword matching toward user's interests |
| `active_hours` | When the user typically chats | Could trigger "Good morning!" vs "Late night, huh?" |
| `emotion_baseline` | Most common emotion states | Detects deviation — if usually happy but suddenly sad, respond with more care |
| `humor_receptiveness` | Does the user respond well to jokes/playfulness? | Tunes companion personality warmth |
| `correction_patterns` | What the user frequently corrects | Avoids repeating mistakes |
| `preferred_response_length` | Does the user prefer short or detailed answers? | Included in system prompt hints |
| `relationship_stage` | How many total interactions, how long since first use | Affects intimacy/familiarity of responses |
| `favorite_topics` | Topics that consistently produce positive signals | Companion can proactively bring these up |

### How Profile Data Is Collected

Every interaction contributes passively:
- Message length → `average_message_length` (rolling average)
- Keywords from sentence encoder clusters → `common_topics` (frequency counter)
- Timestamp → `active_hours` (hour-of-day histogram)
- Personal Emotion Model output → `emotion_baseline` (frequency counter)
- Correction signals → `correction_patterns` (pattern list)

**No explicit questions needed.** The companion learns purely by observing.

### How Profile Data Is Used

The user profile is summarized and injected into Claude's system prompt as context:

```
=== USER PROFILE (learned over time) ===
Communication style: Casual, uses slang occasionally, prefers medium-length responses.
Common interests: programming, anime, music, gaming.
Emotional baseline: Usually happy/neutral. Tends to get frustrated when debugging.
Humor: Receptive to light jokes and playful teasing.
Relationship: 47 sessions over 3 months. Familiar, comfortable tone appropriate.
=== END USER PROFILE ===
```

This helps Claude give more personalized responses, which then get stored as higher-quality learned responses AND better training data for the micro-models.

---

## Screen Capture Learning

The visual awareness system uses the Intent Classifier to help determine when a user wants the companion to see their screen, supplemented by explicit phrase triggers.

### Explicit Triggers (hardcoded, always active):
```
"look at this", "see this", "check this out", "what do you think of this",
"what am I looking at", "see my screen", "take a look", "can you see",
"what's on my screen", "look here", "show you something"
```

### Learned Triggers (from user behavior):

Every time the user manually clicks the Screen button, the system:
1. Captures the input text
2. Extracts 2-4 word n-gram phrases
3. Stores new phrases in `visual_triggers` table at confidence 0.3
4. Repeated manual captures with similar phrases → confidence grows
5. At confidence ≥ 0.6 → phrase becomes an auto-trigger
6. False positive corrections → confidence drops

Additionally, the Intent Classifier learns the `visual_request` category. Over time, it can detect visual intent from phrasing patterns even without matching an explicit trigger phrase. This catches novel phrasings like "what's happening on my monitor?" that no trigger phrase covers.

---

## Emotion Learning

### Three-Layer Emotion Detection

```
User message: "This code keeps breaking and I can't figure out why"
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Seed Lexicon │ │  Base Model  │ │Personal Model│
            │ (keyword)    │ │ (pre-trained)│ │(your data)   │
            │              │ │              │ │              │
            │ "breaking" → │ │ frustration: │ │ angry: 0.15  │
            │  angry (0.4) │ │  0.72        │ │ frustrated:  │
            │              │ │ anger: 0.15  │ │  0.65        │
            │              │ │ sadness: 0.08│ │ determined:  │
            └──────┬───────┘ └──────┬───────┘ │  0.12        │
                   │                │         └──────┬───────┘
                   │                │                │
                   ▼                ▼                ▼
              ┌─────────────────────────────────────────┐
              │           EMOTION BLENDER               │
              │                                         │
              │ If personal model has <30 examples:     │
              │   Use base model (100%)                 │
              │ If 30-200 examples:                     │
              │   Blend (increasing personal weight)    │
              │ If 200+ examples:                       │
              │   80% personal + 20% base               │
              │                                         │
              │ Seed lexicon is always checked first    │
              │ as a fast pre-filter / tiebreaker       │
              │                                         │
              │ Result: "frustrated" (0.68 confidence)  │
              └─────────────────────────────────────────┘
```

### How the Seed Lexicon Grows

The seed lexicon ships with the app:
```json
{
  "happy": ["great", "awesome", "love", "amazing", "wonderful", "yay"],
  "sad": ["sad", "unfortunately", "miss", "lost", "disappointed"],
  "angry": ["angry", "frustrated", "annoyed", "hate", "stupid", "broken"],
  "confused": ["confused", "don't understand", "what do you mean", "huh"],
  "exhausted": ["tired", "exhausted", "done", "can't anymore", "drained"]
}
```

It grows when:
1. User explicitly picks an emotion → words from their message get added to that emotion's list
2. Personal Emotion Model reaches high confidence (>0.85) on a detection → the top contributing words (by attention/gradient) get added
3. Words that get associated with multiple emotions equally are removed (they're not discriminative)

---

## Evolution Over Time

### Week 1–2: Bootstrap Phase
- Pre-trained models handle understanding (embeddings, base emotion detection)
- Micro-models are empty — all decisions use formula-based fallbacks
- Almost everything routes to Claude (Tier 3)
- Knowledge DB is accumulating entries with pre-computed vectors
- Training buffer is filling but hasn't triggered a retrain yet
- User profile is forming

### Month 1: Micro-Models Activate
- Response Ranker has ~50-100 training examples → starts influencing ranking
- Personal Emotion Model has ~30 examples from explicit emotion picks → starts blending with base
- Intent Classifier has ~40 examples → starts routing decisions
- Knowledge DB has 100-300 entries with vectors → semantic search is working
- Local brain handles ~15-25% of interactions with noticeably better matching than keywords alone
- First "core knowledge" entries may appear for frequently-discussed topics

### Month 2–3: Growing Intelligence
- Response Ranker has ~200+ examples → primary ranking mechanism, formula is secondary
- Personal Emotion Model has ~100+ examples → 50/50 blend with base, noticeably personalized
- Knowledge DB has 500-1000+ entries
- Local brain handles ~35-50% of conversations
- The companion's local responses feel contextually appropriate — right tone, right emotion
- Keyword expansion + semantic vectors mean the brain catches paraphrases reliably

### Month 6+: Mature Brain
- All micro-models are well-trained and stable
- Response Ranker effectively captures the user's preferences
- Personal Emotion Model dominates (80/20 blend) — truly understands THIS user
- Local brain handles ~55-70% of interactions
- The companion feels like it genuinely knows the user
- Claude is called for genuinely novel, complex, or creative requests only
- Training still continues but improvements are incremental

### The Ceiling (~65-75%)

With real ML models, the ceiling is higher than pure pattern matching (~60-70% → ~65-75%). The extra ~5% comes from:
- Semantic matching catching paraphrases that keywords miss
- The Response Ranker learning subtle preference patterns
- The Intent Classifier routing more accurately
- Better emotion detection leading to more contextually appropriate local responses

The ceiling still exists because:
- Novel topics always require Claude
- Complex multi-step reasoning requires Claude
- Creative generation requires Claude
- The user's evolving interests continuously introduce new territory

---

## Data Storage & Privacy

### What's Stored Locally
- All learned responses with pre-computed vectors → `knowledge.db`
- Micro-model weights → `models/*.json` (JSON files, a few hundred KB each)
- Training logs and metrics → `knowledge.db` (training_log table)
- User profile data → `knowledge.db` (user_profile table)
- Emotion lexicon → `knowledge.db` (emotion_lexicon table)
- Visual trigger phrases → `knowledge.db` (visual_triggers table)

### What's NOT Stored
- Raw conversation transcripts (only normalized patterns and responses)
- Pre-trained model weights (these live in a shared cache managed by `@xenova/transformers`, not in the character pack)
- Audio recordings (mic input is processed and discarded)
- Screenshots (captured to temp dir, auto-deleted after sending to Claude)
- Passwords, tokens, or sensitive data

### Data Portability
- Each character pack has its own `knowledge.db` AND its own `models/` directory
- Switching characters switches both the knowledge base AND the trained micro-models
- Exporting a character pack includes: knowledge DB + model weights + character definition + emotion images = a complete, self-contained intelligence
- Importing a character pack brings its full learned personality
- Deleting `knowledge.db` and `models/` resets a character to factory state (new brain, no memories)

---

## File Structure Addition

The neural network code lives in:

```
src/main/neural/
├── tensor.js               -- Tensor operations: matmul, add, relu, softmax, sigmoid,
│                              backward passes, gradient computation
├── model.js                -- MicroModel class: forward, backward, train, save, load
├── response-ranker.js      -- ResponseRanker: architecture [776→128→32→1], training loop
├── emotion-model.js        -- PersonalEmotionModel: architecture [384→64→19], training loop
├── intent-model.js         -- IntentClassifier: architecture [384→32→8], training loop
├── trainer.js              -- BackgroundTrainer: schedules retraining, manages training buffer
├── embedder.js             -- Wrapper around @xenova/transformers Sentence Encoder
└── models/                 -- (created at runtime, per character pack)
    ├── response-ranker-weights.json
    ├── emotion-model-weights.json
    └── intent-model-weights.json
```

---

## Summary: What Makes This a Real Brain

| Feature | Pattern Matching (v1) | Neural Brain (final) |
|---------|----------------------|---------------------|
| Text understanding | Keywords, FTS5 | 384-dim semantic vectors via Sentence Encoder |
| Response selection | Formula: Jaccard × confidence × recency | Learned neural ranker trained on YOUR feedback |
| Emotion detection | Keyword lexicon | Pre-trained base model + personal model trained on YOUR emotion patterns |
| Intent classification | None (all messages treated equally) | 8-category classifier trained on YOUR usage patterns |
| Matching "I'm feeling down" to "I'm sad" | Fails (no shared keywords) | Works (cosine similarity: 0.94) |
| Knowing that YOU express anger differently than average | Can't | Personal Emotion Model specializes in you |
| Learning that YOU prefer short answers in the morning | Can't | Response Ranker discovers this from metadata features |
| Adapting to your evolving interests | Slow (keyword accumulation) | Fast (vectors capture meaning, ranker adapts) |
| Getting smarter over time | Somewhat (confidence tuning) | Yes (neural weights update, capturing patterns no formula could) |

The companion starts as a search engine with a memory. It ends as a genuine personal intelligence — one that understands meaning, recognizes your emotions, knows your preferences, and makes increasingly smart decisions about when it can help you itself and when it should ask Claude.
