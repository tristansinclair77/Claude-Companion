'use strict';

// ── Emotion constants (mirrors shared/constants.js) ────────────────────────────

const EMOTIONS = [
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'soft_smile', emoji: '🙂', label: 'Soft Smile' },
  { id: 'laughing', emoji: '😄', label: 'Laughing' },
  { id: 'confident', emoji: '😎', label: 'Confident' },
  { id: 'smug', emoji: '😏', label: 'Smug' },
  { id: 'surprised', emoji: '😮', label: 'Surprised' },
  { id: 'shocked', emoji: '😱', label: 'Shocked' },
  { id: 'confused', emoji: '😕', label: 'Confused' },
  { id: 'thinking', emoji: '🤔', label: 'Thinking' },
  { id: 'concerned', emoji: '😟', label: 'Concerned' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
  { id: 'determined', emoji: '💪', label: 'Determined' },
  { id: 'embarrassed', emoji: '😳', label: 'Embarrassed' },
  { id: 'exhausted', emoji: '😴', label: 'Exhausted' },
  { id: 'pout', emoji: '😤', label: 'Pout' },
  { id: 'crying', emoji: '😭', label: 'Crying' },
  { id: 'lustful_desire', emoji: '😍', label: 'Lustful Desire' },
  { id: 'excited', emoji: '🤩', label: 'Excited' },
  { id: 'loving', emoji: '💗', label: 'Loving' },
  { id: 'nervous', emoji: '😬', label: 'Nervous' },
  { id: 'longing', emoji: '🥺', label: 'Longing' },
  { id: 'curious', emoji: '🧐', label: 'Curious' },
  { id: 'disappointed', emoji: '😞', label: 'Disappointed' },
  { id: 'relieved', emoji: '😅', label: 'Relieved' },
  { id: 'playful', emoji: '😜', label: 'Playful' },
  { id: 'proud', emoji: '🫡', label: 'Proud' },
  { id: 'apologetic', emoji: '🙏', label: 'Apologetic' },
  { id: 'content', emoji: '😌', label: 'Content' },
  { id: 'flirty', emoji: '😘', label: 'Flirty' },
  { id: 'flustered', emoji: '😖', label: 'Flustered' },
  { id: 'in_awe', emoji: '😲', label: 'In Awe' },
  { id: 'in_pleasure', emoji: '🥰', label: 'In Pleasure' },
  { id: 'sleepy', emoji: '💤', label: 'Sleepy' },
  { id: 'sickly', emoji: '🤒', label: 'Sickly' },
  { id: 'wheezing_laughter', emoji: '🤣', label: 'Wheezing Laughter' },
  { id: 'frantic_desperation', emoji: '😰', label: 'Frantic Desperation' },
];

const COMBINED_EMOTIONS = [
  { id: 'happy_confused', emoji: '😊😕', label: 'Happy & Confused' },
  { id: 'nervous_excited', emoji: '😬🤩', label: 'Nervous & Excited' },
  { id: 'sad_angry', emoji: '😢😠', label: 'Sad & Angry' },
  { id: 'concerned_thinking', emoji: '😟🤔', label: 'Concerned & Thinking' },
  { id: 'embarrassed_laughing', emoji: '😳😄', label: 'Embarrassed & Laughing' },
  { id: 'loving_sad', emoji: '💗😢', label: 'Loving & Sad' },
  { id: 'confident_smug', emoji: '😎😏', label: 'Confident & Smug' },
  { id: 'exhausted_sad', emoji: '😴😢', label: 'Exhausted & Sad' },
  { id: 'flustered_nervous', emoji: '😖😬', label: 'Flustered & Nervous' },
  { id: 'curious_confused', emoji: '🧐😕', label: 'Curious & Confused' },
  { id: 'sickly_sad', emoji: '🤒😢', label: 'Sickly & Sad' },
  { id: 'sickly_exhausted', emoji: '🤒😴', label: 'Sickly & Exhausted' },
  { id: 'relieved_exhausted', emoji: '😅😴', label: 'Relieved & Exhausted' },
  { id: 'proud_loving', emoji: '🫡💗', label: 'Proud & Loving' },
  { id: 'playful_confident', emoji: '😜😎', label: 'Playful & Confident' },
  { id: 'shocked_confused', emoji: '😱😕', label: 'Shocked & Confused' },
  { id: 'longing_sad', emoji: '🥺😢', label: 'Longing & Sad' },
  { id: 'content_loving', emoji: '😌💗', label: 'Content & Loving' },
  { id: 'embarrassed_apologetic', emoji: '😳🙏', label: 'Embarrassed & Apologetic' },
  { id: 'frantic_desperation_crying', emoji: '😰😭', label: 'Frantic & Crying' },
  { id: 'laughing_crying', emoji: '😄😭', label: 'Laughing & Crying' },
  { id: 'smug_angry', emoji: '😏😠', label: 'Smug & Angry' },
  { id: 'thinking_concerned', emoji: '🤔😟', label: 'Thinking & Concerned' },
  { id: 'excited_nervous', emoji: '🤩😬', label: 'Excited & Nervous' },
  { id: 'in_pleasure_embarrassed', emoji: '🥰😳', label: 'In Pleasure & Embarrassed' },
  { id: 'flirty_nervous', emoji: '😘😬', label: 'Flirty & Nervous' },
  { id: 'wheezing_laughter_exhausted', emoji: '🤣😴', label: 'Wheezing & Exhausted' },
];

// ── State ──────────────────────────────────────────────────────────────────────

let state = {
  characterDir: null,
  isDirty: false,
};

// Maps emotionId -> { filePath: string|null, dataUrl: string|null }
const portraitState = {
  base: {},     // base emotion portraits
  combined: {}, // combined emotion portraits
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function setDirty(d) {
  state.isDirty = d;
  const el = $('cb-status-dirty');
  if (el) el.style.display = d ? 'inline' : 'none';
}

function showToast(msg, isError = false, durationMs = 2800) {
  const el = $('cb-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? 'error show' : 'show';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); }, durationMs);
}

function setStatus(msg) {
  const el = $('cb-status-msg');
  if (el) el.textContent = msg;
}

function setPathDisplay(p) {
  const pathEl = $('cb-char-path');
  const statusEl = $('cb-status-path');
  const short = p ? p.replace(/\\/g, '/').split('/').slice(-2).join('/') : '— no character loaded —';
  if (pathEl) pathEl.textContent = p ? short : '— no character loaded —';
  if (statusEl) statusEl.textContent = p || 'no character loaded';
}

// ── Tab Management ─────────────────────────────────────────────────────────────

let activeTab = 'identity';
let portraitsLoaded = false;

function switchTab(tabId) {
  document.querySelectorAll('.cb-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.cb-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tabId}`);
  });
  activeTab = tabId;
  if (tabId === 'portraits' && !portraitsLoaded) {
    loadAllPortraitPreviews();
    portraitsLoaded = true;
  }
}

// ── List Editor ────────────────────────────────────────────────────────────────
// Creates a reusable add/remove list widget.  Returns { getItems() }

function buildListEditor(container, initialItems, multiline = false) {
  container.innerHTML = '';
  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'cb-list-items';
  container.appendChild(itemsDiv);

  const addBtn = document.createElement('button');
  addBtn.className = 'cb-add-btn';
  addBtn.textContent = '+ ADD ITEM';
  container.appendChild(addBtn);

  function addRow(value) {
    const row = document.createElement('div');
    row.className = 'cb-list-item';

    if (multiline) {
      const ta = document.createElement('textarea');
      ta.className = 'cb-textarea';
      ta.style.minHeight = '38px';
      ta.value = value || '';
      ta.addEventListener('input', () => setDirty(true));
      row.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'cb-input';
      inp.value = value || '';
      inp.addEventListener('input', () => setDirty(true));
      row.appendChild(inp);
    }

    const rm = document.createElement('button');
    rm.className = 'cb-remove-btn';
    rm.title = 'Remove';
    rm.textContent = '✕';
    rm.addEventListener('click', () => { row.remove(); setDirty(true); });
    row.appendChild(rm);
    itemsDiv.appendChild(row);
  }

  (initialItems || []).forEach(v => addRow(v));
  addBtn.addEventListener('click', () => { addRow(''); setDirty(true); });

  return {
    getItems() {
      const els = itemsDiv.querySelectorAll('input[type="text"], textarea');
      return Array.from(els).map(el => el.value.trim()).filter(Boolean);
    },
    setItems(arr) {
      itemsDiv.innerHTML = '';
      (arr || []).forEach(v => addRow(v));
    },
  };
}

// ── Emotion select helper ──────────────────────────────────────────────────────

function buildEmotionSelect(selectEl) {
  selectEl.innerHTML = '';
  EMOTIONS.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.emoji} ${e.label}`;
    selectEl.appendChild(opt);
  });
}

// ── Filler Tab ─────────────────────────────────────────────────────────────────

function buildFillerCategoryEl(key, data) {
  const card = document.createElement('div');
  card.className = 'filler-category';
  card.dataset.key = key;

  // Header
  const header = document.createElement('div');
  header.className = 'filler-cat-header';

  const toggle = document.createElement('span');
  toggle.className = 'filler-cat-toggle';
  toggle.textContent = '▾';

  const keyInput = document.createElement('input');
  keyInput.className = 'filler-cat-key-input';
  keyInput.value = key;
  keyInput.title = 'Category key (used in JSON)';
  keyInput.addEventListener('input', e => { e.stopPropagation(); setDirty(true); });
  keyInput.addEventListener('click', e => e.stopPropagation());

  const removeBtn = document.createElement('button');
  removeBtn.className = 'cb-remove-btn';
  removeBtn.style.marginLeft = 'auto';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Delete category';
  removeBtn.addEventListener('click', e => { e.stopPropagation(); card.remove(); setDirty(true); });

  header.appendChild(toggle);
  header.appendChild(keyInput);
  header.appendChild(removeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'filler-cat-body';

  // Toggle collapse
  header.addEventListener('click', () => {
    const collapsed = body.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '▸' : '▾';
  });

  // Triggers
  const triggerRow = document.createElement('div');
  triggerRow.className = 'filler-triggers-row';
  const trigLabel = document.createElement('span');
  trigLabel.className = 'filler-trigger-label';
  trigLabel.textContent = 'TRIGGERS';

  const triggersArea = document.createElement('div');
  triggersArea.className = 'filler-triggers-area';
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'filler-trigger-tags';

  function addTriggerTag(val) {
    const tag = document.createElement('span');
    tag.className = 'filler-trigger-tag';
    tag.dataset.value = val;
    const txt = document.createElement('span');
    txt.textContent = val;
    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Remove trigger';
    del.addEventListener('click', () => { tag.remove(); setDirty(true); });
    tag.appendChild(txt);
    tag.appendChild(del);
    tagsDiv.appendChild(tag);
  }

  (data.triggers || []).forEach(t => addTriggerTag(t));

  const trigInput = document.createElement('input');
  trigInput.className = 'filler-trigger-input';
  trigInput.placeholder = 'Add trigger, press Enter';
  trigInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && trigInput.value.trim()) {
      addTriggerTag(trigInput.value.trim());
      trigInput.value = '';
      setDirty(true);
      e.preventDefault();
    }
  });

  triggersArea.appendChild(tagsDiv);
  triggersArea.appendChild(trigInput);
  triggerRow.appendChild(trigLabel);
  triggerRow.appendChild(triggersArea);
  body.appendChild(triggerRow);

  // Responses
  const responsesLabel = document.createElement('div');
  responsesLabel.style.cssText = 'font-size:10px;letter-spacing:2px;color:var(--cyan-dim);margin:8px 0 6px;';
  responsesLabel.textContent = 'RESPONSES';
  body.appendChild(responsesLabel);

  const responsesContainer = document.createElement('div');
  body.appendChild(responsesContainer);

  let responseCount = 0;

  function addResponseCard(resp = {}) {
    responseCount++;
    const card2 = document.createElement('div');
    card2.className = 'filler-response-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'filler-response-card-header';
    const num = document.createElement('span');
    num.className = 'filler-response-num';
    num.textContent = `RESPONSE ${responseCount}`;
    const delBtn = document.createElement('button');
    delBtn.className = 'cb-remove-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete response';
    delBtn.addEventListener('click', () => { card2.remove(); setDirty(true); });
    cardHeader.appendChild(num);
    cardHeader.appendChild(delBtn);
    card2.appendChild(cardHeader);

    // Dialogue
    const dRow = document.createElement('div');
    dRow.className = 'filler-response-row';
    const dLabel = document.createElement('span');
    dLabel.className = 'filler-response-label';
    dLabel.textContent = 'dialogue';
    const dTa = document.createElement('textarea');
    dTa.className = 'cb-textarea';
    dTa.style.minHeight = '40px';
    dTa.value = resp.dialogue || '';
    dTa.addEventListener('input', () => setDirty(true));
    dRow.appendChild(dLabel);
    dRow.appendChild(dTa);
    card2.appendChild(dRow);

    // Thoughts
    const tRow = document.createElement('div');
    tRow.className = 'filler-response-row';
    const tLabel = document.createElement('span');
    tLabel.className = 'filler-response-label';
    tLabel.textContent = 'thoughts';
    const tTa = document.createElement('textarea');
    tTa.className = 'cb-textarea';
    tTa.style.minHeight = '40px';
    tTa.value = resp.thoughts || '';
    tTa.addEventListener('input', () => setDirty(true));
    tRow.appendChild(tLabel);
    tRow.appendChild(tTa);
    card2.appendChild(tRow);

    // Emotion
    const eRow = document.createElement('div');
    eRow.className = 'filler-response-row';
    const eLabel = document.createElement('span');
    eLabel.className = 'filler-response-label';
    eLabel.textContent = 'emotion';
    const eSel = document.createElement('select');
    eSel.className = 'cb-select';
    buildEmotionSelect(eSel);
    eSel.value = resp.emotion || 'neutral';
    eSel.addEventListener('change', () => setDirty(true));
    eRow.appendChild(eLabel);
    eRow.appendChild(eSel);
    card2.appendChild(eRow);

    responsesContainer.appendChild(card2);
  }

  (data.responses || []).forEach(r => addResponseCard(r));

  const addRespBtn = document.createElement('button');
  addRespBtn.className = 'cb-add-btn';
  addRespBtn.style.marginTop = '4px';
  addRespBtn.textContent = '+ ADD RESPONSE';
  addRespBtn.addEventListener('click', () => { addResponseCard(); setDirty(true); });
  body.appendChild(addRespBtn);

  // Serialization helper attached to element
  card.getFillerData = function() {
    const catKey = keyInput.value.trim();
    const triggers = Array.from(tagsDiv.querySelectorAll('.filler-trigger-tag'))
      .map(t => t.dataset.value).filter(Boolean);
    const responses = Array.from(responsesContainer.querySelectorAll('.filler-response-card'))
      .map(rc => {
        const textareas = rc.querySelectorAll('textarea');
        const sel = rc.querySelector('select');
        return {
          dialogue: textareas[0]?.value || '',
          thoughts: textareas[1]?.value || '',
          emotion: sel?.value || 'neutral',
        };
      });
    return { catKey, triggers, responses };
  };

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// ── Portraits Tab ──────────────────────────────────────────────────────────────

function buildPortraitGrid(container, emotionList, isBase) {
  container.innerHTML = '';
  const bucket = isBase ? 'base' : 'combined';

  emotionList.forEach(em => {
    const slot = document.createElement('div');
    slot.className = 'portrait-slot';
    slot.dataset.emotionId = em.id;
    slot.dataset.bucket = bucket;

    const label = document.createElement('div');
    label.className = 'portrait-slot-label';
    label.textContent = `${em.emoji} ${em.label}`;

    const preview = document.createElement('div');
    preview.className = 'portrait-slot-preview';
    const img = document.createElement('img');
    img.style.display = 'none';
    const noImg = document.createElement('span');
    noImg.className = 'no-img';
    noImg.textContent = 'NO IMG';
    preview.appendChild(img);
    preview.appendChild(noImg);

    const pathLabel = document.createElement('div');
    pathLabel.className = 'portrait-slot-path';
    pathLabel.title = '';

    const btns = document.createElement('div');
    btns.className = 'portrait-slot-btns';

    const pickBtn = document.createElement('button');
    pickBtn.className = 'cb-add-btn';
    pickBtn.textContent = 'PICK';
    pickBtn.title = `Pick image for ${em.label}`;
    pickBtn.addEventListener('click', async () => {
      const result = await window.charBuilderAPI.pickImage();
      if (!result.success) return;
      portraitState[bucket][em.id] = { filePath: result.filePath, dataUrl: result.dataUrl };
      img.src = result.dataUrl;
      img.style.display = '';
      noImg.style.display = 'none';
      const fname = result.filePath.replace(/\\/g, '/').split('/').pop();
      pathLabel.textContent = fname;
      pathLabel.title = result.filePath;
      setDirty(true);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'cb-remove-btn';
    clearBtn.textContent = '✕';
    clearBtn.title = 'Clear image';
    clearBtn.addEventListener('click', () => {
      portraitState[bucket][em.id] = { filePath: null, dataUrl: null };
      img.src = '';
      img.style.display = 'none';
      noImg.style.display = '';
      pathLabel.textContent = '';
      pathLabel.title = '';
      setDirty(true);
    });

    btns.appendChild(pickBtn);
    btns.appendChild(clearBtn);
    slot.appendChild(label);
    slot.appendChild(preview);
    slot.appendChild(pathLabel);
    slot.appendChild(btns);
    container.appendChild(slot);
  });
}

// Lazy-loads base64 previews for all slots that have a filePath but no dataUrl yet
async function loadAllPortraitPreviews() {
  setStatus('Loading portrait previews...');
  const allSlots = document.querySelectorAll('.portrait-slot');
  const batchSize = 8;
  let i = 0;
  const slotsArr = Array.from(allSlots);

  async function loadBatch() {
    const batch = slotsArr.slice(i, i + batchSize);
    i += batchSize;

    for (const slot of batch) {
      const emotionId = slot.dataset.emotionId;
      const bucket = slot.dataset.bucket;
      const entry = portraitState[bucket][emotionId];
      if (!entry || !entry.filePath) continue;
      if (entry.dataUrl) {
        applyPortraitPreview(slot, entry.dataUrl, entry.filePath);
        continue;
      }
      const result = await window.charBuilderAPI.readImage(entry.filePath);
      if (result.success && result.dataUrl) {
        portraitState[bucket][emotionId].dataUrl = result.dataUrl;
        applyPortraitPreview(slot, result.dataUrl, entry.filePath);
      }
    }

    if (i < slotsArr.length) {
      setTimeout(loadBatch, 20);
    } else {
      setStatus('');
    }
  }

  await loadBatch();
}

function applyPortraitPreview(slot, dataUrl, filePath) {
  const img = slot.querySelector('img');
  const noImg = slot.querySelector('.no-img');
  const pathLabel = slot.querySelector('.portrait-slot-path');
  if (!img) return;
  img.src = dataUrl;
  img.style.display = '';
  if (noImg) noImg.style.display = 'none';
  if (pathLabel && filePath) {
    const fname = filePath.replace(/\\/g, '/').split('/').pop();
    pathLabel.textContent = fname;
    pathLabel.title = filePath;
  }
}

// ── Populate form from loaded data ─────────────────────────────────────────────

const listEditors = {};

function populateForm(data) {
  const { character: ch = {}, rules: ru = {}, fillerResponses: fr = {}, appearance: ap = {}, emotionImages = {} } = data;

  // — IDENTITY —
  $('id-name').value          = ch.name || '';
  $('id-full-name').value     = ch.full_name || '';
  $('id-age').value           = ch.age_appearance || '';
  $('id-greeting').value      = ch.greeting || '';
  $('id-initial-thoughts').value = ch.initial_thoughts || '';
  $('id-personality').value   = ch.personality_summary || '';
  $('id-speech-style').value  = ch.speech_style || '';
  $('id-backstory').value     = ch.backstory || '';
  $('id-ref-image').value     = ch.character_reference_image || '';
  $('id-appearance-file').value = ch.appearance_file || 'appearance.json';

  const emotionSel = $('id-initial-emotion');
  buildEmotionSelect(emotionSel);
  emotionSel.value = ch.initial_emotion || 'neutral';

  listEditors.likes    = buildListEditor($('editor-likes'),    ch.likes    || []);
  listEditors.dislikes = buildListEditor($('editor-dislikes'), ch.dislikes || []);
  listEditors.quirks   = buildListEditor($('editor-quirks'),   ch.quirks   || []);

  // — RULES —
  $('rules-character').value = ru.character || ch.name || '';
  $('rules-version').value   = ru.version || '1.0.0';
  listEditors.rules = buildListEditor($('editor-rules'), ru.rules || [], true);

  // — FILLER —
  const fillerContainer = $('filler-categories');
  fillerContainer.innerHTML = '';
  for (const [key, val] of Object.entries(fr)) {
    fillerContainer.appendChild(buildFillerCategoryEl(key, val));
  }

  // — APPEARANCE —
  $('app-height').value        = ap.height || '';
  $('app-build').value         = ap.build || '';
  $('app-hair').value          = ap.hair || '';
  $('app-eyes').value          = ap.eyes || '';
  $('app-skin').value          = ap.skin || '';
  $('app-face').value          = ap.face || '';
  $('app-self-desc').value     = ap.self_description || '';

  const outfit = ap.outfit || {};
  $('app-outfit-top').value     = outfit.top || '';
  $('app-outfit-harness').value = outfit.harness || '';
  $('app-outfit-tie').value     = outfit.tie || '';
  $('app-outfit-shorts').value  = outfit.shorts || '';
  $('app-outfit-legwear').value = outfit.legwear || '';
  $('app-outfit-boots').value   = outfit.boots || '';
  $('app-outfit-gloves').value  = outfit.gloves || '';

  const acc = ap.accessories || {};
  $('app-acc-headset').value  = acc.headset || '';
  $('app-acc-harness').value  = acc.harness_detail || '';

  const col = ap.color_palette || {};
  $('app-col-primary').value   = col.primary || '';
  $('app-col-secondary').value = col.secondary || '';
  $('app-col-tech').value      = col.accent_tech || '';
  $('app-col-identity').value  = col.accent_identity || '';
  $('app-col-hair').value      = col.hair || '';
  $('app-col-eyes').value      = col.eyes || '';

  listEditors.visualNotes = buildListEditor($('editor-visual-notes'), ap.visual_notes || [], true);

  const art = ap.art || {};
  $('app-art-ref').value   = art.character_reference || '';
  $('app-art-sheet').value = art.character_reference_sheet || '';
  $('app-art-front').value = art.front_body || '';
  $('app-art-back').value  = art.back || '';
  $('app-art-side').value  = art.side_face || '';

  // — PORTRAITS — (store paths, actual images loaded lazily when tab is viewed)
  portraitState.base     = {};
  portraitState.combined = {};

  const eiBase     = emotionImages.base     || {};
  const eiCombined = emotionImages.combined || {};

  EMOTIONS.forEach(em => {
    portraitState.base[em.id] = eiBase[em.id]
      ? { filePath: eiBase[em.id].filePath, dataUrl: null }
      : { filePath: null, dataUrl: null };
  });
  COMBINED_EMOTIONS.forEach(em => {
    portraitState.combined[em.id] = eiCombined[em.id]
      ? { filePath: eiCombined[em.id].filePath, dataUrl: null }
      : { filePath: null, dataUrl: null };
  });

  // Mark portraits as needing reload next time the tab opens
  portraitsLoaded = false;

  // Rebuild portrait grids (clears previews)
  buildPortraitGrid($('portraits-base-grid'),     EMOTIONS,          true);
  buildPortraitGrid($('portraits-combined-grid'), COMBINED_EMOTIONS, false);

  // If portraits tab is currently active, load previews immediately
  if (activeTab === 'portraits') {
    loadAllPortraitPreviews();
    portraitsLoaded = true;
  }
}

// ── Serialize form to data objects ────────────────────────────────────────────

function serializeCharacter() {
  return {
    name:                    $('id-name').value.trim(),
    full_name:               $('id-full-name').value.trim(),
    age_appearance:          $('id-age').value.trim(),
    character_reference_image: $('id-ref-image').value.trim() || undefined,
    appearance_file:         $('id-appearance-file').value.trim() || 'appearance.json',
    personality_summary:     $('id-personality').value.trim(),
    speech_style:            $('id-speech-style').value.trim(),
    likes:                   listEditors.likes?.getItems()    || [],
    dislikes:                listEditors.dislikes?.getItems() || [],
    quirks:                  listEditors.quirks?.getItems()   || [],
    backstory:               $('id-backstory').value.trim(),
    greeting:                $('id-greeting').value.trim(),
    initial_thoughts:        $('id-initial-thoughts').value.trim(),
    initial_emotion:         $('id-initial-emotion').value || 'neutral',
  };
}

function serializeRules(characterName) {
  return {
    character: $('rules-character').value.trim() || characterName || '',
    version:   $('rules-version').value.trim() || '1.0.0',
    rules:     listEditors.rules?.getItems() || [],
  };
}

function serializeFillerResponses() {
  const result = {};
  document.querySelectorAll('.filler-category').forEach(card => {
    if (typeof card.getFillerData === 'function') {
      const { catKey, triggers, responses } = card.getFillerData();
      if (catKey) result[catKey] = { triggers, responses };
    }
  });
  return result;
}

function serializeAppearance(characterName) {
  return {
    character:               characterName || '',
    character_reference_image: $('id-ref-image').value.trim() || undefined,
    height:                  $('app-height').value.trim(),
    build:                   $('app-build').value.trim(),
    hair:                    $('app-hair').value.trim(),
    eyes:                    $('app-eyes').value.trim(),
    skin:                    $('app-skin').value.trim(),
    face:                    $('app-face').value.trim(),
    self_description:        $('app-self-desc').value.trim(),
    outfit: {
      top:     $('app-outfit-top').value.trim(),
      harness: $('app-outfit-harness').value.trim(),
      tie:     $('app-outfit-tie').value.trim(),
      shorts:  $('app-outfit-shorts').value.trim(),
      legwear: $('app-outfit-legwear').value.trim(),
      boots:   $('app-outfit-boots').value.trim(),
      gloves:  $('app-outfit-gloves').value.trim(),
    },
    accessories: {
      headset:        $('app-acc-headset').value.trim(),
      harness_detail: $('app-acc-harness').value.trim(),
    },
    color_palette: {
      primary:          $('app-col-primary').value.trim(),
      secondary:        $('app-col-secondary').value.trim(),
      accent_tech:      $('app-col-tech').value.trim(),
      accent_identity:  $('app-col-identity').value.trim(),
      hair:             $('app-col-hair').value.trim(),
      eyes:             $('app-col-eyes').value.trim(),
    },
    visual_notes: listEditors.visualNotes?.getItems() || [],
    art: {
      character_reference:       $('app-art-ref').value.trim(),
      character_reference_sheet: $('app-art-sheet').value.trim(),
      front_body:                $('app-art-front').value.trim(),
      back:                      $('app-art-back').value.trim(),
      side_face:                 $('app-art-side').value.trim(),
    },
  };
}

function serializePortraitImages() {
  const base = {};
  const combined = {};
  for (const [id, entry] of Object.entries(portraitState.base)) {
    if (entry.filePath) base[id] = entry.filePath;
  }
  for (const [id, entry] of Object.entries(portraitState.combined)) {
    if (entry.filePath) combined[id] = entry.filePath;
  }
  return { base, combined };
}

// ── Clear form (NEW) ───────────────────────────────────────────────────────────

function clearForm() {
  populateForm({
    character: {},
    rules: { character: '', version: '1.0.0', rules: [] },
    fillerResponses: {},
    appearance: {},
    emotionImages: { base: {}, combined: {} },
  });
}

// ── Dirty-tracking: attach 'input'/'change' listeners ─────────────────────────

function attachDirtyListeners() {
  const inputs = document.querySelectorAll(
    '#pane-identity input, #pane-identity textarea, #pane-identity select,' +
    '#pane-rules input, #pane-rules textarea,' +
    '#pane-appearance input, #pane-appearance textarea'
  );
  inputs.forEach(el => el.addEventListener('input', () => setDirty(true)));
  inputs.forEach(el => el.addEventListener('change', () => setDirty(true)));
}

// ── LOAD ──────────────────────────────────────────────────────────────────────

async function handleLoad() {
  if (state.isDirty) {
    const ok = confirm('You have unsaved changes. Load a new character and discard them?');
    if (!ok) return;
  }
  setStatus('Opening directory picker...');
  const result = await window.charBuilderAPI.load();
  if (!result || result.canceled || !result.success) {
    setStatus('');
    return;
  }
  state.characterDir = result.characterDir;
  setPathDisplay(result.characterDir);
  populateForm(result);
  setDirty(false);
  setStatus('');
  showToast('Character loaded.');
}

// ── SAVE ──────────────────────────────────────────────────────────────────────

async function handleSave() {
  let saveDir = state.characterDir;

  if (!saveDir) {
    // NEW character — ask user where to save
    const picked = await window.charBuilderAPI.pickSaveDir();
    if (!picked.success) { showToast('Save cancelled.', false, 1800); return; }
    saveDir = picked.dirPath;
    state.characterDir = saveDir;
    setPathDisplay(saveDir);
  }

  setStatus('Saving...');
  const character         = serializeCharacter();
  const rules             = serializeRules(character.name);
  const fillerResponses   = serializeFillerResponses();
  const appearance        = serializeAppearance(character.name);
  const { base: emotionImages, combined: combinedEmotionImages } = serializePortraitImages();

  const result = await window.charBuilderAPI.save({
    characterDir: saveDir,
    character,
    rules,
    fillerResponses,
    appearance,
    emotionImages,
    combinedEmotionImages,
  });

  setStatus('');
  if (result.success) {
    setDirty(false);
    showToast('Character saved.');
  } else {
    showToast(`Save failed: ${result.error}`, true, 4000);
  }
}

// ── NEW ────────────────────────────────────────────────────────────────────────

function handleNew() {
  if (state.isDirty) {
    const ok = confirm('You have unsaved changes. Start a new blank character and discard them?');
    if (!ok) return;
  }
  state.characterDir = null;
  setPathDisplay(null);
  clearForm();
  setDirty(false);
  showToast('New character started.');
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  // Window controls
  $('btn-minimize').addEventListener('click', () => window.charBuilderAPI.minimize());
  $('btn-maximize').addEventListener('click', () => window.charBuilderAPI.maximize());
  $('btn-close').addEventListener('click',    () => window.charBuilderAPI.close());

  // Action buttons
  $('cb-btn-new').addEventListener('click',  handleNew);
  $('cb-btn-load').addEventListener('click', handleLoad);
  $('cb-btn-save').addEventListener('click', handleSave);

  // Tab switching
  document.querySelectorAll('.cb-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filler: add category
  $('filler-add-cat').addEventListener('click', () => {
    const key = `new_category_${Date.now()}`;
    const card = buildFillerCategoryEl(key, { triggers: [], responses: [] });
    $('filler-categories').appendChild(card);
    setDirty(true);
  });

  // Build emotion select for initial_emotion
  buildEmotionSelect($('id-initial-emotion'));

  // Build empty portrait grids
  buildPortraitGrid($('portraits-base-grid'),     EMOTIONS,          true);
  buildPortraitGrid($('portraits-combined-grid'), COMBINED_EMOTIONS, false);

  // List editors for identity/appearance (empty state)
  listEditors.likes       = buildListEditor($('editor-likes'),       []);
  listEditors.dislikes    = buildListEditor($('editor-dislikes'),    []);
  listEditors.quirks      = buildListEditor($('editor-quirks'),      []);
  listEditors.rules       = buildListEditor($('editor-rules'),       [], true);
  listEditors.visualNotes = buildListEditor($('editor-visual-notes'), [], true);

  attachDirtyListeners();

  console.log('[CharBuilder] initialized.');
}

init();
