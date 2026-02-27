'use strict';
// Chat controller — handles sending messages, routing through brain, showing responses.

var ChatController = (() => {
  const inputEl   = document.getElementById('user-input');
  const sendBtn   = document.getElementById('btn-send');
  const loadingEl = document.getElementById('loading-overlay');

  let isSending = false;
  let lastResponseSource = null;

  function init() {
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      // Enter (without Shift) sends
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  async function sendMessage() {
    if (isSending) return;

    const message = inputEl.value.trim();
    if (!message) return;

    isSending = true;
    sendBtn.disabled = true;
    inputEl.value = '';

    const userEmotion = EmotionPicker.getSelected() || 'neutral';
    let attachments = FileAttach.getAttachments();

    // Auto-capture screen if visual trigger detected
    const autoCaptured = await ScreenCaptureUI.checkAndAutoCapture(message);
    if (autoCaptured) {
      attachments = FileAttach.getAttachments(); // refresh after auto-capture
    }

    // Show loading overlay ONLY for Claude (not filler/local) —
    // we'll hide it when response arrives, and show it now as precaution
    loadingEl.classList.remove('hidden');

    try {
      const response = await window.claudeAPI.sendMessage({
        message,
        userEmotion,
        attachments,
      });

      loadingEl.classList.add('hidden');

      if (response.success) {
        // Render response
        CompanionDisplay.showResponse({
          dialogue: response.dialogue,
          thoughts: response.thoughts,
          emotion: response.emotion,
          source: response.source,
        });

        // Update source indicator
        SourceIndicator.update(response.source);

        lastResponseSource = response.source;

        // If it was a filler or local, hide loading immediately
        if (response.source !== 'claude') {
          loadingEl.classList.add('hidden');
        }

        // Clear emotion after use (optional: keep for multi-turn context)
        // EmotionPicker.clear();

        // Clear attachments after sending
        FileAttach.clear();

        // Send implicit feedback signal after next message
        // (we'll check the next message the user sends)
      } else {
        CompanionDisplay.showResponse({
          dialogue: '...I had trouble reaching my thoughts. Try again?',
          thoughts: `Error: ${response.error}`,
          emotion: 'concerned',
          source: 'claude',
        });
        SourceIndicator.update('claude');
      }
    } catch (err) {
      loadingEl.classList.add('hidden');
      CompanionDisplay.showResponse({
        dialogue: 'Something went wrong on my end. Give me a moment?',
        thoughts: `Caught error: ${err.message}`,
        emotion: 'embarrassed',
        source: 'claude',
      });
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function getLastSource() {
    return lastResponseSource;
  }

  return { init, sendMessage, getLastSource };
})();
