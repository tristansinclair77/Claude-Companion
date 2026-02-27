'use strict';
// Renders companion dialogue (typewriter), thoughts, emotion badge, and portrait swap.

var CompanionDisplay = (() => {
  const dialogueEl  = document.getElementById('dialogue-text');
  const thoughtsEl  = document.getElementById('thoughts-text');
  const emotionEl   = document.getElementById('emotion-badge');
  const portraitEl  = document.getElementById('companion-portrait');

  let typewriterTimer = null;
  let characterDir = '../../characters/default'; // default; updated from app.js

  const EMOTIONS = {
    neutral:        { emoji: '😐', color: '#888888' },
    happy:          { emoji: '😊', color: '#ffdd00' },
    soft_smile:     { emoji: '🙂', color: '#ffcc44' },
    laughing:       { emoji: '😄', color: '#ff9900' },
    confident:      { emoji: '😎', color: '#00ccff' },
    smug:           { emoji: '😏', color: '#aa44ff' },
    surprised:      { emoji: '😮', color: '#ffaa00' },
    shocked:        { emoji: '😱', color: '#ff4444' },
    confused:       { emoji: '😕', color: '#aa8800' },
    thinking:       { emoji: '🤔', color: '#4488ff' },
    concerned:      { emoji: '😟', color: '#ff8844' },
    sad:            { emoji: '😢', color: '#4488bb' },
    angry:          { emoji: '😠', color: '#ff2222' },
    determined:     { emoji: '💪', color: '#ff6600' },
    embarrassed:    { emoji: '😳', color: '#ff88aa' },
    exhausted:      { emoji: '😴', color: '#666688' },
    pout:           { emoji: '😤', color: '#dd6600' },
    crying:         { emoji: '😭', color: '#6688cc' },
    lustful_desire: { emoji: '😍', color: '#ff44aa' },
  };

  function setCharacterDir(dir) {
    characterDir = dir;
  }

  function showResponse({ dialogue, thoughts, emotion, source }) {
    // Stop any running typewriter
    if (typewriterTimer) clearTimeout(typewriterTimer);

    // Update thoughts immediately
    thoughtsEl.textContent = thoughts || '';

    // Update emotion badge
    setEmotion(emotion || 'neutral');

    // Typewriter for dialogue
    typewriterText(dialogueEl, dialogue || '', 22);

    // Flash neon effect
    dialogueEl.classList.remove('new-response');
    void dialogueEl.offsetWidth; // force reflow
    dialogueEl.classList.add('new-response');
  }

  function setEmotion(emotionId) {
    const info = EMOTIONS[emotionId] || EMOTIONS.neutral;

    // Update badge text
    emotionEl.textContent = `${info.emoji} ${emotionId.replace('_', ' ').toUpperCase()}`;
    emotionEl.style.color = info.color;
    emotionEl.style.borderColor = info.color + '44';

    // Swap portrait image
    const imgPath = `../../characters/default/emotions/${emotionId}.png`;
    if (portraitEl.getAttribute('src') !== imgPath) {
      portraitEl.style.opacity = '0';
      portraitEl.src = imgPath;
      portraitEl.onload = () => {
        portraitEl.style.transition = 'opacity 0.3s';
        portraitEl.style.opacity = '1';
      };
      portraitEl.onerror = () => {
        // Fallback to neutral
        portraitEl.src = '../../characters/default/emotions/neutral.png';
        portraitEl.style.opacity = '1';
      };
    }
  }

  function typewriterText(el, text, delayMs) {
    el.textContent = '';
    el.classList.add('typewriter-cursor');
    let i = 0;

    function step() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        typewriterTimer = setTimeout(step, delayMs);
      } else {
        el.classList.remove('typewriter-cursor');
      }
    }

    step();
  }

  function setGreeting(character) {
    dialogueEl.textContent = '';
    thoughtsEl.textContent = character.initial_thoughts || '';
    setEmotion(character.initial_emotion || 'soft_smile');

    // Type out greeting
    typewriterText(dialogueEl, character.greeting || `Hi! I'm ${character.name}.`, 30);

    // Set avatar
    const avatarEl = document.getElementById('avatar-img');
    if (avatarEl) {
      avatarEl.src = '../../characters/default/avatar-small.png';
    }
  }

  return { showResponse, setEmotion, setGreeting, setCharacterDir };
})();
