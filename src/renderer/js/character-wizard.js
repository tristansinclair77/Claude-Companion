'use strict';

/**
 * Character Builder Wizard
 *
 * A guided, step-by-step helper that walks the user through filling in every
 * field of the character builder one at a time.  Claude AI help is available
 * at every step.
 *
 * ── HOW TO ADD A NEW FIELD ────────────────────────────────────────────────
 * 1. Add the HTML element to character-builder.html (give it an id).
 * 2. Add an entry to FIELD_SCHEMA below with the same id.
 * The wizard automatically includes it in the flow — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Personality scenario questions ───────────────────────────────────────────
// Each one is presented as its own step; answers are collected then sent to
// Claude together to generate the personality_summary + speech_style fields.

const PERSONALITY_SCENARIOS = [
  {
    key: 'scenario_hello',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 1: First Hello',
    question: 'The user opens the app for the very first time and says hello. What does your character say and do?',
    placeholder: 'e.g. She grins and waves — "Hey! I\'ve been waiting~ What\'s on your mind?"',
  },
  {
    key: 'scenario_help',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 2: Asking for Help',
    question: 'The user asks for help with something complex and technical. How does your character approach it?',
    placeholder: 'e.g. She leans in eagerly, eyes lighting up — "Ooh, let me figure this out with you!"',
  },
  {
    key: 'scenario_disagree',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 3: Disagreement',
    question: 'The user says something your character thinks is wrong or unfair. What happens?',
    placeholder: 'e.g. She pauses and tilts her head — "Hmm... I see it a bit differently, actually."',
  },
  {
    key: 'scenario_upset',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 4: User Is Upset',
    question: 'The user seems stressed, sad, or frustrated. How does your character respond?',
    placeholder: 'e.g. She goes quiet for a moment, then says softly — "Hey... want to talk about it?"',
  },
  {
    key: 'scenario_teased',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 5: Being Teased',
    question: 'The user playfully teases or jokes with your character. How does she react?',
    placeholder: 'e.g. She crosses her arms in a mock pout, but can\'t hide her smile.',
  },
  {
    key: 'scenario_uncertain',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 6: Doesn\'t Know Something',
    question: "Your character is asked something they're not sure about. How do they handle it?",
    placeholder: "e.g. She admits it openly — \"I'm not sure, but let me find out!\" — and tries anyway.",
  },
  {
    key: 'scenario_goodbye',
    section: 'PERSONALITY — Scenarios',
    label: 'Scenario 7: Saying Goodbye',
    question: 'The user says they have to go for now. How does your character handle the goodbye?',
    placeholder: "e.g. She waves with a small smile — \"Come back soon, okay? I'll be here~\"",
  },
];

// ── Field schema ─────────────────────────────────────────────────────────────
// This array defines every step the wizard walks through.
//
// Field types:
//   text           — single-line input
//   textarea       — multi-line input (add supportsImages:true for image analysis)
//   select         — dropdown (uses EMOTIONS list)
//   list           — dynamic list of short strings
//   list-multiline — dynamic list of multi-line strings
//   scenario       — personality scenario Q&A (auto-inserted from PERSONALITY_SCENARIOS)
//   personality-generate — collects scenario answers → Claude generates fields
//   filler         — Claude generates the whole filler-responses JSON block
//
// Keys:
//   id          — DOM element id in character-builder.html (null for list/special)
//   editorKey   — key in window._cbInternal.listEditors (list types only)
//   skipAI      — hide the AI HELP controls for this step
//   supportsImages — show image-upload + "Analyze from Image" for this step

const FIELD_SCHEMA = [

  // ── IDENTITY ───────────────────────────────────────────────────────────────
  {
    id: 'id-name', type: 'text', section: 'IDENTITY',
    label: 'Character Name',
    description: 'The name your character goes by.',
    placeholder: 'e.g. Aria',
    aiHint: 'Suggest a short, memorable name for an AI companion character.',
  },
  {
    id: 'id-full-name', type: 'text', section: 'IDENTITY',
    label: 'Full Name / Designation',
    description: 'Official full name or model designation.',
    placeholder: 'e.g. Aria-7 Synthetic Companion Unit',
    aiHint: 'Generate a full designation that fits the character name and their theme.',
  },
  {
    id: 'id-age', type: 'text', section: 'IDENTITY',
    label: 'Age Appearance',
    description: 'How old does the character appear to be?',
    placeholder: 'e.g. early 20s',
    aiHint: 'Suggest an age appearance that fits this character.',
  },
  {
    id: 'id-initial-emotion', type: 'select', section: 'IDENTITY',
    label: 'Initial Emotion',
    description: 'Default emotion displayed when a new session starts.',
    aiHint: 'Choose an appropriate starting emotion. Respond with just the emotion ID (e.g. soft_smile).',
  },
  {
    id: 'id-greeting', type: 'textarea', section: 'IDENTITY',
    label: 'Greeting Message',
    description: 'What the character says at the start of every new session.',
    placeholder: "e.g. Hey! I'm Aria~ What's on your mind today?",
    aiHint: 'Write a short, in-character greeting message.',
  },
  {
    id: 'id-initial-thoughts', type: 'textarea', section: 'IDENTITY',
    label: 'Initial Thoughts',
    description: "The character's private internal monologue at session start (not shown to user).",
    placeholder: 'e.g. A new session begins...',
    aiHint: 'Write a brief internal thought the character has when a new session starts.',
  },

  // ── PERSONALITY — Scenarios ────────────────────────────────────────────────
  // (scenario steps injected from PERSONALITY_SCENARIOS — see below)

  // personality-generate step is also auto-inserted after the last scenario.

  // These two are pre-filled by Claude after the generate step:
  {
    id: 'id-personality', type: 'textarea', section: 'PERSONALITY',
    label: 'Personality Summary',
    description: 'Core personality traits and overall vibe — injected directly into the AI system prompt. Review and edit what Claude generated, or write your own.',
    aiHint: 'Write a detailed personality summary for this character based on everything known so far.',
  },
  {
    id: 'id-speech-style', type: 'textarea', section: 'PERSONALITY',
    label: 'Speech Style',
    description: 'How the character speaks — tone, vocabulary, and unique language patterns.',
    aiHint: 'Describe the speech style in detail: tone, vocabulary level, signature phrases, punctuation habits.',
  },
  {
    id: 'id-backstory', type: 'textarea', section: 'IDENTITY',
    label: 'Backstory',
    description: "The character's history and origin story.",
    aiHint: 'Write an engaging backstory that fits the character name, personality, and appearance described so far.',
  },

  // ── TRAITS ────────────────────────────────────────────────────────────────
  {
    id: null, editorKey: 'likes', type: 'list', section: 'IDENTITY — TRAITS',
    label: 'Likes',
    description: 'Things the character enjoys, is interested in, or values. One item per entry.',
    aiHint: 'Generate 5-8 specific things this character likes. Respond with a JSON array of short strings.',
  },
  {
    id: null, editorKey: 'dislikes', type: 'list', section: 'IDENTITY — TRAITS',
    label: 'Dislikes',
    description: 'Things the character dislikes, avoids, or finds irritating.',
    aiHint: 'Generate 4-6 things this character dislikes. Respond with a JSON array of short strings.',
  },
  {
    id: null, editorKey: 'quirks', type: 'list', section: 'IDENTITY — TRAITS',
    label: 'Quirks',
    description: 'Unique behavioral habits, mannerisms, or personality quirks.',
    aiHint: 'Generate 4-6 interesting quirks for this character. Respond with a JSON array of short descriptive strings.',
  },

  // ── RULES ─────────────────────────────────────────────────────────────────
  {
    id: 'rules-character', type: 'text', section: 'RULES', skipAI: true,
    label: 'Rules — Character Name',
    description: 'The character name this ruleset belongs to (should match the name above).',
  },
  {
    id: 'rules-version', type: 'text', section: 'RULES', skipAI: true,
    label: 'Rules — Version',
    description: 'Version string for the ruleset.',
    placeholder: '1.0.0',
  },
  {
    id: null, editorKey: 'rules', type: 'list-multiline', section: 'RULES',
    label: 'Behavioral Rules',
    description: 'Guidelines that define how the character speaks and behaves — injected directly into the AI system prompt.',
    aiHint: 'Generate 6-10 specific behavioral rules for this character. Each rule should be a clear instruction. Respond with a JSON array of strings.',
  },

  // ── FILLER ────────────────────────────────────────────────────────────────
  {
    id: null, type: 'filler', section: 'FILLER RESPONSES',
    label: 'Filler Responses',
    description: 'Pre-written quick responses for common short inputs (greetings, laughter, etc.). Generate them automatically below, or Skip to configure manually in the Filler tab.',
    aiHint: 'Generate a complete filler-responses JSON object for this character. Include 5-7 categories (greetings, acknowledgments, laughter, farewells, thinking, agreement, etc.). Each category has "triggers" (string array) and "responses" (array of {dialogue, thoughts, emotion} objects using valid emotion IDs). Match the character\'s voice perfectly. Respond with ONLY valid JSON.',
    skipAI: true,
  },

  // ── APPEARANCE — Physical ──────────────────────────────────────────────────
  {
    id: 'app-height', type: 'text', section: 'APPEARANCE — Physical',
    label: 'Height',
    description: "Character height (imperial and/or metric).",
    placeholder: "e.g. 5'6\" (167.6 cm)",
    aiHint: "Suggest a height that fits this character's personality and style.",
  },
  {
    id: 'app-build', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Build',
    description: 'Body type and physical build description.',
    aiHint: "Describe the character's physical build in detail.",
    supportsImages: true,
  },
  {
    id: 'app-hair', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Hair',
    description: 'Hair color, style, length, and texture.',
    aiHint: "Describe the character's hair in detail.",
    supportsImages: true,
  },
  {
    id: 'app-eyes', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Eyes',
    description: 'Eye color, shape, size, and notable features.',
    aiHint: "Describe the character's eyes in detail.",
    supportsImages: true,
  },
  {
    id: 'app-skin', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Skin',
    description: 'Skin tone, texture, and any notable features.',
    aiHint: "Describe the character's skin tone and texture.",
    supportsImages: true,
  },
  {
    id: 'app-face', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Face',
    description: 'Facial structure, features, and overall look.',
    aiHint: "Describe the character's face in detail.",
    supportsImages: true,
  },
  {
    id: 'app-self-desc', type: 'textarea', section: 'APPEARANCE — Physical',
    label: 'Self Description',
    description: "How the character describes their own appearance in their own words and voice.",
    aiHint: "Write a first-person self-description in the character's own voice and speech style.",
    supportsImages: true,
  },

  // ── APPEARANCE — Outfit ────────────────────────────────────────────────────
  {
    id: 'app-outfit-top', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Top',
    description: 'Upper body clothing description.',
    aiHint: "Describe the character's top/upper body clothing.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-harness', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Harness / Outer Layer',
    description: 'Harness, vest, jacket, or outer layer.',
    aiHint: "Describe any harness or outer layer worn. Leave empty if none.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-tie', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Tie / Neck Accessory',
    description: 'Tie, bow, scarf, or neck accessory.',
    aiHint: "Describe the neck accessory. Leave empty if none.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-shorts', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Bottoms',
    description: 'Lower body clothing (shorts, skirt, pants, etc.).',
    aiHint: "Describe the lower body clothing.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-legwear', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Legwear',
    description: 'Stockings, leggings, socks, or other leg accessories.',
    aiHint: "Describe the legwear. Leave empty if none.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-boots', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Footwear',
    description: 'Boots, shoes, or other footwear.',
    aiHint: "Describe the footwear.",
    supportsImages: true,
  },
  {
    id: 'app-outfit-gloves', type: 'textarea', section: 'APPEARANCE — Outfit',
    label: 'Outfit: Gloves',
    description: 'Gloves, gauntlets, or hand accessories.',
    aiHint: "Describe gloves or handwear. Leave empty if none.",
    supportsImages: true,
  },

  // ── APPEARANCE — Accessories ───────────────────────────────────────────────
  {
    id: 'app-acc-headset', type: 'textarea', section: 'APPEARANCE — Accessories',
    label: 'Accessories: Headset',
    description: 'Head accessories, headset, or headwear.',
    aiHint: "Describe any head accessories or headset. Leave empty if none.",
    supportsImages: true,
  },
  {
    id: 'app-acc-harness', type: 'textarea', section: 'APPEARANCE — Accessories',
    label: 'Accessories: Harness Detail',
    description: 'Detailed description of harness accessories or extra gear.',
    aiHint: "Describe harness accessories in detail. Leave empty if none.",
    supportsImages: true,
  },

  // ── APPEARANCE — Colors ────────────────────────────────────────────────────
  {
    id: 'app-col-primary', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Primary',
    description: "The single most dominant color in the character's overall look (outfit, design, etc.). One color only — e.g. \"Red\" or \"Deep Crimson Red\".",
    placeholder: 'e.g. Deep Crimson Red',
    aiHint: "Name ONE specific color — the single most dominant color in the character's outfit or overall design. A color name or short phrase like 'Deep Crimson Red'. Do NOT list multiple colors, do NOT describe the whole palette, do NOT include hair or eye color.",
    supportsImages: true,
  },
  {
    id: 'app-col-secondary', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Secondary',
    description: "The second most prominent color in the character's look. One color only — e.g. \"White\" or \"Ivory\".",
    placeholder: 'e.g. White',
    aiHint: "Name ONE specific color — the second most prominent color in the character's outfit or overall design. A color name or short phrase like 'White' or 'Ivory'. Do NOT list multiple colors.",
    supportsImages: true,
  },
  {
    id: 'app-col-tech', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Tech Accent',
    description: 'A single accent color for tech, glowing, metallic, or sci-fi elements — e.g. "Gold" or "Electric Blue".',
    placeholder: 'e.g. Gold',
    aiHint: "Name ONE specific color for tech, glowing, metallic, or sci-fi accent elements on the character. A color name or short phrase like 'Gold' or 'Electric Blue'. One color only.",
    supportsImages: true,
  },
  {
    id: 'app-col-identity', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Identity Accent',
    description: "A single signature color tied to this character's identity — a recurring color in their accessories, motifs, or signature elements.",
    placeholder: 'e.g. Crimson',
    aiHint: "Name ONE specific color that acts as a recurring signature or identity marker for this character — used in accessories, motifs, or distinctive elements. One color only.",
    supportsImages: true,
  },
  {
    id: 'app-col-hair', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Hair',
    description: "Hair color — one short descriptor, e.g. \"Pale Rose Pink\" or \"Silver-White\".",
    placeholder: 'e.g. Pale Rose Pink',
    aiHint: "Name the hair color in one short phrase (e.g. 'Pale Rose Pink'). Match the Hair description above. One color descriptor only.",
  },
  {
    id: 'app-col-eyes', type: 'text', section: 'APPEARANCE — Colors',
    label: 'Color: Eyes',
    description: "Eye color — one short descriptor, e.g. \"Pale Teal Blue\" or \"Amber\".",
    placeholder: 'e.g. Pale Teal Blue',
    aiHint: "Name the eye color in one short phrase (e.g. 'Pale Teal Blue'). One color descriptor only.",
  },

  // ── APPEARANCE — Visual Notes ──────────────────────────────────────────────
  {
    id: null, editorKey: 'visualNotes', type: 'list-multiline', section: 'APPEARANCE — Visual Notes',
    label: 'Visual Notes',
    description: 'Additional notes about visual style, rendering hints, or distinguishing features — synthesized from all appearance data.',
    aiHint: 'Based on ALL the appearance data provided (physical build, hair, eyes, skin, face, outfit, accessories, colors), generate as many specific visual notes as make sense for this character. Focus on: distinctive physical features (cat ears, tail, etc.), notable visual contrasts, how appearance reflects personality, implied posture/mannerisms, color combinations, and anything that makes them immediately recognizable. Each note should be a self-contained observation that adds something not already obvious from the appearance fields. Respond with a JSON array of strings.',
    autoFill: true,
  },

  // ── APPEARANCE — Art References ────────────────────────────────────────────
  {
    id: 'app-art-sheet', type: 'text', section: 'APPEARANCE — Art References', skipAI: true,
    label: 'Art: Reference Sheet',
    description: "Filename of the character reference sheet (e.g. \"CharacterName_ReferenceSheet.png\"). This will also be used as the main character reference image.",
    placeholder: 'e.g. CharacterName_ReferenceSheet.png',
  },
];

// ── WizardController ─────────────────────────────────────────────────────────

class WizardController {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
    this.scenarioAnswers = {};   // { key: answerText }
    this.stepImages = {};        // { stepIndex: [{ filePath, dataUrl }] }
    this.pendingSuggestion = null;
    this.isAILoading = false;
    this._built = false;
  }

  // ── Build step list ──────────────────────────────────────────────────────

  _buildSteps() {
    if (this._built) return;
    this._built = true;

    const steps = [];

    for (const field of FIELD_SCHEMA) {
      // Inject personality scenario steps before id-personality
      if (field.id === 'id-personality') {
        for (const sc of PERSONALITY_SCENARIOS) {
          steps.push({ ...sc, type: 'scenario' });
        }
        steps.push({
          type: 'personality-generate',
          section: 'PERSONALITY — Analysis',
          label: 'Generate Personality Profile',
          description: 'All scenario answers collected! Click GENERATE to have Claude analyze your answers and write the personality summary and speech style.',
        });
      }
      steps.push(field);
    }

    this.steps = steps;
  }

  // ── Open / close ─────────────────────────────────────────────────────────

  async open() {
    this._buildSteps();
    this.currentStep = 0;
    this.pendingSuggestion = null;
    document.getElementById('wizard-overlay').style.display = 'flex';
    this._render();

    // If no save directory is set yet, prompt the user to pick one now so
    // that section-based auto-saves have somewhere to write immediately.
    const cb = window._cbInternal;
    if (cb && cb.state && !cb.state.characterDir) {
      const picked = await window.charBuilderAPI.pickSaveDir();
      if (picked.success) {
        cb.state.characterDir = picked.dirPath;
        if (cb.setPathDisplay) cb.setPathDisplay(picked.dirPath);
      }
    }
  }

  close() {
    document.getElementById('wizard-overlay').style.display = 'none';
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  async next() {
    this._commitCurrentStep();
    const oldSection = this.steps[this.currentStep]?.section;
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      const newSection = this.steps[this.currentStep]?.section;
      this.pendingSuggestion = null;
      this._render();
      if (oldSection && newSection && oldSection !== newSection) {
        await this._autoSave();
      }
    } else {
      this._finish();
    }
  }

  back() {
    if (this.currentStep > 0) {
      this._commitCurrentStep();
      this.currentStep--;
      this.pendingSuggestion = null;
      this._render();
    }
  }

  async skip() {
    // Don't commit — keep form's existing value as-is
    const oldSection = this.steps[this.currentStep]?.section;
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      const newSection = this.steps[this.currentStep]?.section;
      this.pendingSuggestion = null;
      this._render();
      if (oldSection && newSection && oldSection !== newSection) {
        await this._autoSave();
      }
    } else {
      this._finish();
    }
  }

  async _autoSave() {
    const cb = window._cbInternal;
    if (!cb || !cb.handleSave) return;
    try {
      await cb.handleSave();
    } catch (err) {
      console.warn('[Wizard] Auto-save failed:', err.message);
    }
  }

  _finish() {
    this.close();
    const cb = window._cbInternal;
    if (cb) cb.setDirty(true);
    const toast = document.getElementById('cb-toast');
    if (toast) {
      toast.textContent = 'Wizard complete! Review your entries and save when ready.';
      toast.className = 'show';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
    }
  }

  // ── Commit wizard inputs → form ──────────────────────────────────────────

  _commitCurrentStep() {
    const step = this.steps[this.currentStep];
    if (!step) return;

    if (step.type === 'text' || step.type === 'textarea') {
      const wInput = document.getElementById('wz-field-input');
      const formEl = step.id ? document.getElementById(step.id) : null;
      if (formEl && wInput) {
        formEl.value = wInput.value;
        formEl.dispatchEvent(new Event('input', { bubbles: true }));
        // Reference sheet → also populate character_reference_image if unset
        if (step.id === 'app-art-sheet' && wInput.value) {
          const refImgEl = document.getElementById('id-ref-image');
          if (refImgEl && !refImgEl.value) {
            refImgEl.value = wInput.value;
            refImgEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    } else if (step.type === 'select') {
      const wSel = document.getElementById('wz-field-select');
      const formEl = step.id ? document.getElementById(step.id) : null;
      if (formEl && wSel) {
        formEl.value = wSel.value;
        formEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (step.type === 'scenario') {
      const ta = document.getElementById('wz-scenario-answer');
      if (ta) this.scenarioAnswers[step.key] = ta.value;
    }
    // list, filler, personality-generate: synced in real time or on accept
  }

  // ── Read form value for a step ───────────────────────────────────────────

  _readFormValue(step) {
    if (step.type === 'text' || step.type === 'textarea') {
      const el = step.id ? document.getElementById(step.id) : null;
      return el ? el.value : '';
    }
    if (step.type === 'select') {
      const el = step.id ? document.getElementById(step.id) : null;
      return el ? el.value : 'neutral';
    }
    if (step.type === 'list' || step.type === 'list-multiline') {
      const cb = window._cbInternal;
      if (!cb || !step.editorKey) return [];
      return cb.listEditors[step.editorKey]?.getItems() || [];
    }
    if (step.type === 'scenario') {
      return this.scenarioAnswers[step.key] || '';
    }
    return '';
  }

  // ── Write a value to the form ────────────────────────────────────────────

  _applyToForm(step, value) {
    const cb = window._cbInternal;

    if (step.type === 'text' || step.type === 'textarea') {
      const el = step.id ? document.getElementById(step.id) : null;
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const wInput = document.getElementById('wz-field-input');
      if (wInput) wInput.value = value;

    } else if (step.type === 'select') {
      const el = step.id ? document.getElementById(step.id) : null;
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const wSel = document.getElementById('wz-field-select');
      if (wSel) wSel.value = value;

    } else if (step.type === 'list' || step.type === 'list-multiline') {
      let arr = [];
      try {
        const raw = typeof value === 'string'
          ? value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
          : value;
        arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) arr = [];
      } catch { arr = []; }
      if (cb && step.editorKey && cb.listEditors[step.editorKey]) {
        cb.listEditors[step.editorKey].setItems(arr);
      }
      this._renderListItems(step, arr);

    } else if (step.type === 'filler') {
      let obj = {};
      try {
        const cleaned = typeof value === 'string'
          ? value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
          : value;
        obj = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } catch {}
      if (cb && obj && typeof obj === 'object') {
        const container = document.getElementById('filler-categories');
        if (container) {
          container.innerHTML = '';
          for (const [key, val] of Object.entries(obj)) {
            container.appendChild(cb.buildFillerCategoryEl(key, val));
          }
        }
      }
    }

    if (cb) cb.setDirty(true);
  }

  // ── List helpers ─────────────────────────────────────────────────────────

  _syncListToForm(step) {
    const itemsDiv = document.getElementById('wz-list-items');
    if (!itemsDiv) return;
    const inputs = itemsDiv.querySelectorAll('input[type="text"], textarea');
    const values = Array.from(inputs).map(el => el.value.trim()).filter(Boolean);
    const cb = window._cbInternal;
    if (cb && step.editorKey && cb.listEditors[step.editorKey]) {
      cb.listEditors[step.editorKey].setItems(values);
    }
  }

  _renderListItems(step, items) {
    const itemsDiv = document.getElementById('wz-list-items');
    if (!itemsDiv) return;
    itemsDiv.innerHTML = '';
    (items || []).forEach(v => this._addListItemRow(itemsDiv, v, step.type === 'list-multiline'));
  }

  _addListItemRow(itemsDiv, value, multiline) {
    const step = this.steps[this.currentStep];
    const row = document.createElement('div');
    row.className = 'wz-list-item';
    if (multiline) {
      const ta = document.createElement('textarea');
      ta.className = 'wz-textarea';
      ta.style.minHeight = '48px';
      ta.value = value || '';
      ta.addEventListener('input', () => this._syncListToForm(step));
      row.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'wz-input';
      inp.value = value || '';
      inp.addEventListener('input', () => this._syncListToForm(step));
      row.appendChild(inp);
    }
    const rm = document.createElement('button');
    rm.className = 'wz-remove-btn';
    rm.textContent = '✕';
    rm.title = 'Remove item';
    rm.addEventListener('click', () => { row.remove(); this._syncListToForm(step); });
    row.appendChild(rm);
    itemsDiv.appendChild(row);
  }

  // ── Filled-field detection ───────────────────────────────────────────────

  _isFieldFilled(step) {
    // 'select' always has a value (defaults to neutral) — not meaningful as "filled"
    if (step.type === 'select' || step.type === 'personality-generate') return false;
    if (step.type === 'scenario') return !!this.scenarioAnswers[step.key]?.trim();
    if (step.type === 'filler') return document.querySelectorAll('.filler-category').length > 0;
    const val = this._readFormValue(step);
    if (Array.isArray(val)) return val.length > 0;
    return !!(val && val.toString().trim().length > 0);
  }

  // ── Build character context for Claude prompts ───────────────────────────

  _buildCharacterContext() {
    const cb = window._cbInternal;
    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    return {
      // Identity
      name:                get('id-name'),
      full_name:           get('id-full-name'),
      age_appearance:      get('id-age'),
      personality_summary: get('id-personality'),
      speech_style:        get('id-speech-style'),
      backstory:           get('id-backstory'),
      likes:    cb?.listEditors?.likes?.getItems()    || [],
      dislikes: cb?.listEditors?.dislikes?.getItems() || [],
      quirks:   cb?.listEditors?.quirks?.getItems()   || [],
      // Appearance — Physical
      height:      get('app-height'),
      build:       get('app-build'),
      hair:        get('app-hair'),
      eyes:        get('app-eyes'),
      skin:        get('app-skin'),
      face:        get('app-face'),
      self_desc:   get('app-self-desc'),
      // Appearance — Outfit
      outfit_top:     get('app-outfit-top'),
      outfit_harness: get('app-outfit-harness'),
      outfit_tie:     get('app-outfit-tie'),
      outfit_bottoms: get('app-outfit-shorts'),
      outfit_legwear: get('app-outfit-legwear'),
      outfit_boots:   get('app-outfit-boots'),
      outfit_gloves:  get('app-outfit-gloves'),
      // Appearance — Accessories
      acc_headset: get('app-acc-headset'),
      acc_harness: get('app-acc-harness'),
      // Appearance — Colors
      col_primary:   get('app-col-primary'),
      col_secondary: get('app-col-secondary'),
      col_tech:      get('app-col-tech'),
      col_identity:  get('app-col-identity'),
      col_hair:      get('app-col-hair'),
      col_eyes:      get('app-col-eyes'),
    };
  }

  // ── Image management ─────────────────────────────────────────────────────

  _getStepImages() {
    return this.stepImages[this.currentStep] || [];
  }

  async _addImage() {
    const result = await window.charBuilderAPI.pickImage();
    if (!result.success) return;
    if (!this.stepImages[this.currentStep]) this.stepImages[this.currentStep] = [];
    this.stepImages[this.currentStep].push({ filePath: result.filePath, dataUrl: result.dataUrl });
    this._refreshImageThumbnails();
  }

  _removeImage(idx) {
    if (this.stepImages[this.currentStep]) {
      this.stepImages[this.currentStep].splice(idx, 1);
    }
    this._refreshImageThumbnails();
  }

  _refreshImageThumbnails() {
    const thumbsEl = document.getElementById('wizard-image-thumbnails');
    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    const imgs = this._getStepImages();
    imgs.forEach((img, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'wz-thumb';
      const imgEl = document.createElement('img');
      imgEl.src = img.dataUrl;
      imgEl.alt = '';
      const del = document.createElement('div');
      del.className = 'wz-thumb-del';
      del.textContent = '✕';
      del.title = 'Remove';
      del.addEventListener('click', () => this._removeImage(idx));
      wrap.appendChild(imgEl);
      wrap.appendChild(del);
      thumbsEl.appendChild(wrap);
    });
  }

  // ── Claude AI help ───────────────────────────────────────────────────────

  async askClaude() {
    if (this.isAILoading) return;
    const step = this.steps[this.currentStep];
    const aiInput = document.getElementById('wizard-ai-input');
    const description = aiInput ? aiInput.value.trim() : '';

    const images = this._getStepImages();
    if (!description && images.length === 0) {
      this._showAIStatus('Describe what you want, or add a reference image first.', true);
      return;
    }

    this._setAILoading(true);
    const context = this._buildCharacterContext();
    const cb = window._cbInternal;

    try {
      const result = await window.charBuilderAPI.askClaude({
        field: {
          label:       step.label,
          description: step.description,
          type:        step.type,
          aiHint:      step.aiHint || '',
        },
        userDescription: description || '(analyze the attached image for this field)',
        characterContext: context,
        emotionOptions: cb?.EMOTIONS?.map(e => e.id) || [],
        imagePaths: images.map(i => i.filePath),
      });

      if (result.success) {
        this.pendingSuggestion = result.value;
        this._showSuggestion(result.value, step);
      } else {
        this._showAIStatus(`AI error: ${result.error || 'Unknown error'}`, true);
      }
    } catch (err) {
      this._showAIStatus(`Failed to reach AI: ${err.message}`, true);
    } finally {
      this._setAILoading(false);
    }
  }

  _setAILoading(loading) {
    this.isAILoading = loading;
    const btn = document.getElementById('wizard-ai-btn');
    if (!btn) return;
    btn.textContent = loading ? 'ASKING…' : 'AI HELP';
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  // ── Personality generate ─────────────────────────────────────────────────

  async _generatePersonality() {
    const genBtn = document.getElementById('wz-gen-btn');
    if (genBtn) { genBtn.textContent = 'GENERATING…'; genBtn.disabled = true; genBtn.classList.add('loading'); }

    const scenariosText = PERSONALITY_SCENARIOS.map(s =>
      `SCENARIO: ${s.question}\nANSWER: ${this.scenarioAnswers[s.key] || '(not answered)'}`
    ).join('\n\n');

    const context = this._buildCharacterContext();
    const cb = window._cbInternal;

    try {
      const result = await window.charBuilderAPI.askClaude({
        field: {
          label:       'Personality Profile',
          description: 'Generate personality_summary AND speech_style based on scenario answers.',
          type:        'personality-generate',
          aiHint:      'Respond with ONLY a valid JSON object with keys "personality_summary" and "speech_style". Both should be detailed paragraphs matching the character revealed through the scenarios.',
        },
        userDescription: `Based on these scenario answers:\n\n${scenariosText}`,
        characterContext: context,
        emotionOptions: cb?.EMOTIONS?.map(e => e.id) || [],
        imagePaths: [],
      });

      if (result.success) {
        try {
          // Strip markdown code fences if Claude wrapped the JSON
          const raw = result.value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          const parsed = JSON.parse(raw);
          if (parsed.personality_summary) {
            const el = document.getElementById('id-personality');
            if (el) { el.value = parsed.personality_summary; el.dispatchEvent(new Event('input')); }
          }
          if (parsed.speech_style) {
            const el = document.getElementById('id-speech-style');
            if (el) { el.value = parsed.speech_style; el.dispatchEvent(new Event('input')); }
          }
          this._showPGStatus('Personality generated! Continuing to review…', false);
          setTimeout(() => this.next(), 1600);
        } catch {
          // If not valid JSON, put the raw text in personality_summary
          const el = document.getElementById('id-personality');
          if (el) { el.value = result.value; el.dispatchEvent(new Event('input')); }
          this._showPGStatus('Generated (raw text — check next steps).', false);
          setTimeout(() => this.next(), 1600);
        }
      } else {
        this._showPGStatus(`AI error: ${result.error || 'Unknown'}`, true);
      }
    } catch (err) {
      this._showPGStatus(`Failed: ${err.message}`, true);
    } finally {
      if (genBtn) { genBtn.textContent = 'GENERATE PERSONALITY'; genBtn.disabled = false; genBtn.classList.remove('loading'); }
    }
  }

  _showPGStatus(msg, isError) {
    let el = document.getElementById('wz-pg-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff4466' : '#00cc88';
  }

  // ── Suggestion display ───────────────────────────────────────────────────

  _showSuggestion(value, step) {
    const suggEl = document.getElementById('wizard-suggestion');
    const previewEl = document.getElementById('wizard-suggestion-preview');
    if (!suggEl || !previewEl) return;

    let display = value;
    if (step.type === 'list' || step.type === 'list-multiline') {
      try {
        const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const arr = JSON.parse(cleaned);
        if (Array.isArray(arr)) display = arr.map((v, i) => `${i + 1}. ${v}`).join('\n');
      } catch {}
    } else if (step.type === 'filler') {
      try {
        const obj = JSON.parse(value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
        display = JSON.stringify(obj, null, 2);
      } catch {}
    }

    previewEl.textContent = display;
    suggEl.style.display = '';
  }

  acceptSuggestion() {
    if (this.pendingSuggestion === null) return;
    const step = this.steps[this.currentStep];
    this._applyToForm(step, this.pendingSuggestion);
    this.pendingSuggestion = null;
    document.getElementById('wizard-suggestion').style.display = 'none';
    const aiInput = document.getElementById('wizard-ai-input');
    if (aiInput) aiInput.value = '';
    this._showAIStatus('Suggestion applied!', false);
  }

  declineSuggestion() {
    this.pendingSuggestion = null;
    document.getElementById('wizard-suggestion').style.display = 'none';
    const aiInput = document.getElementById('wizard-ai-input');
    if (aiInput) aiInput.value = '';
  }

  _showAIStatus(msg, isError) {
    let el = document.getElementById('wz-ai-status');
    const aiRow = document.getElementById('wizard-ai-row');
    if (!aiRow) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'wz-ai-status';
      el.style.cssText = 'font-family:var(--font-mono);font-size:10px;letter-spacing:1px;padding:3px 0;';
      aiRow.after(el);
    }
    el.textContent = msg;
    el.style.color = isError ? '#ff4466' : '#00cc88';
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    const step = this.steps[this.currentStep];
    if (!step) return;

    // Progress
    const pct = this.steps.length > 1
      ? Math.round((this.currentStep / (this.steps.length - 1)) * 100)
      : 100;
    document.getElementById('wizard-progress-fill').style.width = `${pct}%`;
    document.getElementById('wizard-step-counter').textContent =
      `Step ${this.currentStep + 1} of ${this.steps.length}`;
    document.getElementById('wizard-section-label').textContent = step.section || '';
    const _labelEl = document.getElementById('wizard-field-label');
    _labelEl.innerHTML = '';
    _labelEl.appendChild(document.createTextNode(step.label || ''));
    if (this._isFieldFilled(step)) {
      const _badge = document.createElement('span');
      _badge.className = 'wz-filled-badge';
      _badge.textContent = '● FILLED';
      _labelEl.appendChild(_badge);
    }
    document.getElementById('wizard-field-desc').textContent = step.description || '';

    // Reset AI area
    document.getElementById('wizard-suggestion').style.display = 'none';
    const aiInput = document.getElementById('wizard-ai-input');
    if (aiInput) aiInput.value = '';
    const aiStatus = document.getElementById('wz-ai-status');
    if (aiStatus) aiStatus.remove();

    // Auto-fill rules-character from character name if empty
    if (step.id === 'rules-character') {
      const el = document.getElementById('rules-character');
      const nameEl = document.getElementById('id-name');
      if (el && !el.value && nameEl && nameEl.value) el.value = nameEl.value;
    }

    // Input area
    const inputArea = document.getElementById('wizard-input-area');
    inputArea.innerHTML = '';

    switch (step.type) {
      case 'text':               this._renderText(step, inputArea);              break;
      case 'textarea':           this._renderTextarea(step, inputArea);          break;
      case 'select':             this._renderSelect(step, inputArea);            break;
      case 'list':               this._renderList(step, inputArea, false);       break;
      case 'list-multiline':     this._renderList(step, inputArea, true);        break;
      case 'filler':             this._renderFiller(step, inputArea);            break;
      case 'scenario':           this._renderScenario(step, inputArea);          break;
      case 'personality-generate': this._renderPersonalityGenerate(inputArea);  break;
    }

    // AI area visibility
    const aiArea = document.getElementById('wizard-ai-area');
    const hideAI = step.type === 'personality-generate' || step.type === 'scenario' || step.skipAI;
    aiArea.style.display = hideAI ? 'none' : '';

    // Image section (only for supportsImages fields)
    const imageSection = document.getElementById('wizard-image-section');
    if (imageSection) {
      imageSection.style.display = step.supportsImages ? '' : 'none';
      if (step.supportsImages) this._refreshImageThumbnails();
    }

    // Navigation buttons
    const backBtn = document.getElementById('wizard-back-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    const finishBtn = document.getElementById('wizard-finish-btn');
    backBtn.disabled = this.currentStep === 0;
    const isLast = this.currentStep === this.steps.length - 1;
    nextBtn.style.display = isLast ? 'none' : '';
    finishBtn.style.display = isLast ? '' : 'none';
  }

  // ── Input renderers ──────────────────────────────────────────────────────

  _renderText(step, container) {
    const inp = document.createElement('input');
    inp.id = 'wz-field-input';
    inp.type = 'text';
    inp.className = 'wz-input';
    inp.value = this._readFormValue(step);
    inp.placeholder = step.placeholder || '';
    container.appendChild(inp);
  }

  _renderTextarea(step, container) {
    const ta = document.createElement('textarea');
    ta.id = 'wz-field-input';
    ta.className = 'wz-textarea';
    ta.value = this._readFormValue(step);
    ta.placeholder = step.placeholder || '';
    container.appendChild(ta);
  }

  _renderSelect(step, container) {
    const sel = document.createElement('select');
    sel.id = 'wz-field-select';
    sel.className = 'wz-select';
    const cb = window._cbInternal;
    (cb?.EMOTIONS || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.emoji} ${e.label}`;
      sel.appendChild(opt);
    });
    sel.value = this._readFormValue(step) || 'neutral';
    container.appendChild(sel);
  }

  _renderList(step, container, multiline) {
    const wrap = document.createElement('div');

    // AI FILL button — shown for steps that support auto-generation from context
    if (step.autoFill) {
      const existing = this._readFormValue(step);
      const hasItems = existing && existing.length > 0;

      const fillBtn = document.createElement('button');
      fillBtn.id = 'wz-autofill-btn';
      fillBtn.className = 'wz-generate-btn';
      fillBtn.textContent = hasItems ? 'AI FILL (REGENERATE)' : 'AI FILL';
      fillBtn.addEventListener('click', () => this._autoFillList(step));
      wrap.appendChild(fillBtn);

      const status = document.createElement('div');
      status.id = 'wz-autofill-status';
      status.style.cssText = 'font-family:var(--font-mono);font-size:13px;letter-spacing:1px;padding:6px 0;text-align:center;';
      wrap.appendChild(status);
    }

    const itemsDiv = document.createElement('div');
    itemsDiv.id = 'wz-list-items';
    itemsDiv.className = 'wz-list-items';
    wrap.appendChild(itemsDiv);

    const current = this._readFormValue(step);
    (current || []).forEach(v => this._addListItemRow(itemsDiv, v, multiline));

    const addBtn = document.createElement('button');
    addBtn.className = 'wz-add-btn';
    addBtn.textContent = '+ ADD ITEM';
    addBtn.addEventListener('click', () => {
      this._addListItemRow(itemsDiv, '', multiline);
      this._syncListToForm(step);
    });
    wrap.appendChild(addBtn);
    container.appendChild(wrap);
  }

  async _autoFillList(step) {
    const fillBtn = document.getElementById('wz-autofill-btn');
    const statusEl = document.getElementById('wz-autofill-status');

    if (fillBtn) { fillBtn.textContent = 'GENERATING…'; fillBtn.disabled = true; fillBtn.classList.add('loading'); }
    if (statusEl) { statusEl.textContent = 'Asking Claude to generate notes from appearance data…'; statusEl.style.color = '#4a7766'; }

    const context = this._buildCharacterContext();

    try {
      const result = await window.charBuilderAPI.askClaude({
        field: {
          label:       step.label,
          description: step.description,
          type:        'list-multiline',
          aiHint:      step.aiHint || '',
        },
        userDescription: 'Generate visual notes based on all the appearance data filled in so far.',
        characterContext: context,
        emotionOptions: [],
        imagePaths: [],
      });

      if (result.success) {
        this._applyToForm(step, result.value);
        const count = (this._readFormValue(step) || []).length;
        if (statusEl) {
          statusEl.textContent = `✓ ${count} visual notes generated. Edit or add more below, then click NEXT.`;
          statusEl.style.color = '#00cc88';
        }
        if (fillBtn) { fillBtn.textContent = 'AI FILL (REGENERATE)'; fillBtn.disabled = false; fillBtn.classList.remove('loading'); }
      } else {
        if (statusEl) { statusEl.textContent = `Error: ${result.error || 'Unknown error'}`; statusEl.style.color = '#ff4466'; }
        if (fillBtn) {
          fillBtn.textContent = (this._readFormValue(step) || []).length > 0 ? 'AI FILL (REGENERATE)' : 'AI FILL';
          fillBtn.disabled = false; fillBtn.classList.remove('loading');
        }
      }
    } catch (err) {
      if (statusEl) { statusEl.textContent = `Failed: ${err.message}`; statusEl.style.color = '#ff4466'; }
      if (fillBtn) {
        fillBtn.textContent = (this._readFormValue(step) || []).length > 0 ? 'AI FILL (REGENERATE)' : 'AI FILL';
        fillBtn.disabled = false; fillBtn.classList.remove('loading');
      }
    }
  }

  _renderFiller(step, container) {
    const existing = document.querySelectorAll('.filler-category').length;

    const infoBox = document.createElement('div');
    infoBox.className = 'wz-info-box';
    infoBox.textContent = existing > 0
      ? `${existing} filler category/categories are already defined. Click below to regenerate, or click Next to keep them.`
      : 'Claude will generate a complete set of filler responses tailored to your character\'s voice. Click the button below to generate them, or Skip to configure manually in the Filler tab.';
    container.appendChild(infoBox);

    const genBtn = document.createElement('button');
    genBtn.id = 'wz-filler-gen-btn';
    genBtn.className = 'wz-generate-btn';
    genBtn.textContent = existing > 0 ? 'REGENERATE FILLER RESPONSES' : 'GENERATE FILLER RESPONSES';
    genBtn.addEventListener('click', () => this._generateFiller(step));
    container.appendChild(genBtn);

    const status = document.createElement('div');
    status.id = 'wz-filler-status';
    status.style.cssText = 'font-family:var(--font-mono);font-size:13px;letter-spacing:1px;padding:10px 0;text-align:center;';
    container.appendChild(status);
  }

  async _generateFiller(step) {
    const genBtn = document.getElementById('wz-filler-gen-btn');
    const statusEl = document.getElementById('wz-filler-status');

    if (genBtn) { genBtn.textContent = 'GENERATING…'; genBtn.disabled = true; genBtn.classList.add('loading'); }
    if (statusEl) { statusEl.textContent = 'Asking Claude to generate filler responses…'; statusEl.style.color = '#4a7766'; }

    const context = this._buildCharacterContext();
    const cb = window._cbInternal;

    try {
      const result = await window.charBuilderAPI.askClaude({
        field: {
          label:       step.label,
          description: step.description,
          type:        'filler',
          aiHint:      step.aiHint || '',
        },
        userDescription: 'Generate a complete filler response set for this character.',
        characterContext: context,
        emotionOptions: cb?.EMOTIONS?.map(e => e.id) || [],
        imagePaths: [],
      });

      if (result.success) {
        this._applyToForm(step, result.value);
        const count = document.querySelectorAll('.filler-category').length;
        if (statusEl) {
          statusEl.textContent = `✓ ${count} filler categories generated successfully. Click NEXT to continue.`;
          statusEl.style.color = '#00cc88';
        }
        if (genBtn) { genBtn.textContent = 'REGENERATE FILLER RESPONSES'; genBtn.disabled = false; genBtn.classList.remove('loading'); }
      } else {
        if (statusEl) { statusEl.textContent = `Error: ${result.error || 'Unknown error'}`; statusEl.style.color = '#ff4466'; }
        if (genBtn) {
          const existingCount = document.querySelectorAll('.filler-category').length;
          genBtn.textContent = existingCount > 0 ? 'REGENERATE FILLER RESPONSES' : 'GENERATE FILLER RESPONSES';
          genBtn.disabled = false; genBtn.classList.remove('loading');
        }
      }
    } catch (err) {
      if (statusEl) { statusEl.textContent = `Failed: ${err.message}`; statusEl.style.color = '#ff4466'; }
      if (genBtn) {
        const existingCount = document.querySelectorAll('.filler-category').length;
        genBtn.textContent = existingCount > 0 ? 'REGENERATE FILLER RESPONSES' : 'GENERATE FILLER RESPONSES';
        genBtn.disabled = false; genBtn.classList.remove('loading');
      }
    }
  }

  _renderScenario(step, container) {
    const qBox = document.createElement('div');
    qBox.className = 'wz-scenario-question';
    qBox.textContent = step.question;
    container.appendChild(qBox);

    const ta = document.createElement('textarea');
    ta.id = 'wz-scenario-answer';
    ta.className = 'wz-textarea';
    ta.style.minHeight = '100px';
    ta.value = this.scenarioAnswers[step.key] || '';
    ta.placeholder = step.placeholder || 'Describe what your character says or does…';
    container.appendChild(ta);
  }

  _renderPersonalityGenerate(container) {
    // Summary of all scenario Q&As
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'wz-pg-summary';

    const answered = PERSONALITY_SCENARIOS.filter(s => this.scenarioAnswers[s.key]?.trim());
    if (answered.length === 0) {
      summaryDiv.textContent = 'No scenarios answered yet — you can still generate a personality with a description in the field below, or go back to answer the scenarios.';
    } else {
      answered.forEach(s => {
        const row = document.createElement('div');
        row.className = 'wz-pg-row';
        const q = document.createElement('div');
        q.className = 'wz-pg-q';
        q.textContent = `▸ ${s.question}`;
        const a = document.createElement('div');
        a.className = 'wz-pg-a';
        a.textContent = this.scenarioAnswers[s.key];
        row.appendChild(q);
        row.appendChild(a);
        summaryDiv.appendChild(row);
      });
    }
    container.appendChild(summaryDiv);

    const genBtn = document.createElement('button');
    genBtn.id = 'wz-gen-btn';
    genBtn.className = 'wz-generate-btn';
    genBtn.textContent = 'GENERATE PERSONALITY';
    genBtn.addEventListener('click', () => this._generatePersonality());
    container.appendChild(genBtn);

    const status = document.createElement('div');
    status.id = 'wz-pg-status';
    status.style.cssText = 'font-family:var(--font-mono);font-size:10px;letter-spacing:1px;padding:8px 0;text-align:center;';
    container.appendChild(status);

    const skipNote = document.createElement('div');
    skipNote.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:#224433;letter-spacing:1px;margin-top:10px;text-align:center;';
    skipNote.textContent = 'Or click SKIP to write the personality manually in the next steps.';
    container.appendChild(skipNote);
  }
}

// ── Global instance & wiring ──────────────────────────────────────────────────

const wizard = new WizardController();

function initWizard() {
  document.getElementById('wizard-close-btn').addEventListener('click',     () => wizard.close());
  document.getElementById('wizard-back-btn').addEventListener('click',      () => wizard.back());
  document.getElementById('wizard-skip-btn').addEventListener('click',      () => wizard.skip());
  document.getElementById('wizard-next-btn').addEventListener('click',      () => wizard.next());
  document.getElementById('wizard-finish-btn').addEventListener('click',    () => wizard.next());
  document.getElementById('wizard-ai-btn').addEventListener('click',        () => wizard.askClaude());
  document.getElementById('wizard-accept-btn').addEventListener('click',    () => wizard.acceptSuggestion());
  document.getElementById('wizard-decline-btn').addEventListener('click',   () => wizard.declineSuggestion());
  document.getElementById('wizard-add-image-btn').addEventListener('click', () => wizard._addImage());
  document.getElementById('cb-btn-wizard').addEventListener('click',        () => wizard.open());

  // Enter on AI input triggers ask
  document.getElementById('wizard-ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); wizard.askClaude(); }
  });

  // Click backdrop to close
  document.getElementById('wizard-overlay').addEventListener('click', e => {
    if (e.target.id === 'wizard-overlay') wizard.close();
  });
}

initWizard();
