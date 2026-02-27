'use strict';
// Emotion picker popup — 38 emotions in a grid. Click sets user emotion context.

var EmotionPicker = (() => {
  const picker     = document.getElementById('emotion-picker');
  const grid       = document.getElementById('emotion-grid');
  const btnEmotion = document.getElementById('btn-emotion');

  let selectedEmotion = null;
  let onSelectCallback = null;

  const EMOTIONS = [
    // ── Core ──────────────────────────────────────────────────────────────────
    { id: 'neutral',             emoji: '😐', label: 'Neutral' },
    { id: 'happy',               emoji: '😊', label: 'Happy' },
    { id: 'soft_smile',          emoji: '🙂', label: 'Soft Smile' },
    { id: 'laughing',            emoji: '😄', label: 'Laughing' },
    { id: 'confident',           emoji: '😎', label: 'Confident' },
    { id: 'smug',                emoji: '😏', label: 'Smug' },
    { id: 'surprised',           emoji: '😮', label: 'Surprised' },
    { id: 'shocked',             emoji: '😱', label: 'Shocked' },
    { id: 'confused',            emoji: '😕', label: 'Confused' },
    { id: 'thinking',            emoji: '🤔', label: 'Thinking' },
    { id: 'concerned',           emoji: '😟', label: 'Concerned' },
    { id: 'sad',                 emoji: '😢', label: 'Sad' },
    { id: 'angry',               emoji: '😠', label: 'Angry' },
    { id: 'determined',          emoji: '💪', label: 'Determined' },
    { id: 'embarrassed',         emoji: '😳', label: 'Embarrassed' },
    { id: 'exhausted',           emoji: '😴', label: 'Exhausted' },
    { id: 'pout',                emoji: '😤', label: 'Pout' },
    { id: 'crying',              emoji: '😭', label: 'Crying' },
    { id: 'lustful_desire',      emoji: '😍', label: 'Lustful Desire' },
    // ── Extended ──────────────────────────────────────────────────────────────
    { id: 'excited',             emoji: '🤩', label: 'Excited' },
    { id: 'loving',              emoji: '💗', label: 'Loving' },
    { id: 'nervous',             emoji: '😬', label: 'Nervous' },
    { id: 'longing',             emoji: '🥺', label: 'Longing' },
    { id: 'curious',             emoji: '🧐', label: 'Curious' },
    { id: 'disappointed',        emoji: '😞', label: 'Disappointed' },
    { id: 'relieved',            emoji: '😅', label: 'Relieved' },
    { id: 'playful',             emoji: '😜', label: 'Playful' },
    { id: 'proud',               emoji: '🫡', label: 'Proud' },
    { id: 'apologetic',          emoji: '🙏', label: 'Apologetic' },
    { id: 'content',             emoji: '😌', label: 'Content' },
    { id: 'flirty',              emoji: '😘', label: 'Flirty' },
    { id: 'flustered',           emoji: '😖', label: 'Flustered' },
    { id: 'in_awe',              emoji: '😲', label: 'In Awe' },
    { id: 'in_pleasure',         emoji: '🥰', label: 'In Pleasure' },
    { id: 'sleepy',              emoji: '💤', label: 'Sleepy' },
    { id: 'sickly',              emoji: '🤒', label: 'Sickly' },
    { id: 'wheezing_laughter',   emoji: '🤣', label: 'Wheezing Laughter' },
    { id: 'frantic_desperation', emoji: '😰', label: 'Frantic Desperation' },
  ];

  function init(onSelect) {
    onSelectCallback = onSelect;
    buildGrid();

    btnEmotion.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== btnEmotion) {
        picker.classList.add('hidden');
      }
    });
  }

  function buildGrid() {
    grid.innerHTML = '';
    for (const em of EMOTIONS) {
      const btn = document.createElement('button');
      btn.className = 'emotion-btn';
      btn.dataset.id = em.id;
      btn.title = em.label;
      btn.innerHTML = `<span class="emoji">${em.emoji}</span>${em.label}`;
      btn.addEventListener('click', () => selectEmotion(em.id));
      grid.appendChild(btn);
    }
  }

  function selectEmotion(id) {
    selectedEmotion = id;
    picker.classList.add('hidden');

    // Visual feedback on the picker button
    btnEmotion.textContent = `${EMOTIONS.find((e) => e.id === id)?.emoji || '😊'} MOOD`;

    // Highlight selected
    for (const btn of grid.querySelectorAll('.emotion-btn')) {
      btn.classList.toggle('selected', btn.dataset.id === id);
    }

    if (onSelectCallback) onSelectCallback(id);

    // Update input placeholder
    const input = document.getElementById('user-input');
    if (input) input.placeholder = `[${id}] Type a message...`;
  }

  function getSelected() {
    return selectedEmotion;
  }

  function clear() {
    selectedEmotion = null;
    btnEmotion.textContent = '😊 EMOTION';
    const input = document.getElementById('user-input');
    if (input) input.placeholder = 'Type a message...';
    for (const btn of grid.querySelectorAll('.emotion-btn')) {
      btn.classList.remove('selected');
    }
  }

  return { init, getSelected, clear };
})();
