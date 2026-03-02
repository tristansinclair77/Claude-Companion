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

    const btnSaveChat = document.getElementById('btn-save-chat');
    if (btnSaveChat) btnSaveChat.addEventListener('click', saveChat);

    // Stream partial dialogue from Claude as it generates — hides loading overlay
    // and shows text in real-time so the user doesn't stare at a blank screen.
    // When the CLI connects, switch to the thinking portrait while the overlay
    // stays up — this pre-loads the portrait so it's ready when the overlay drops.
    window.claudeAPI.on('claude:stream-chunk', ({ text }) => {
      if (isSending && !text) {
        CompanionDisplay.showThinking();
      }
    });

    // Unsolicited interjection from Aria (curiosity / dead-topics system).
    // Fires when the lull timer detects inactivity and Aria picks a stored thread.
    window.claudeAPI.on('companion:interject', (data) => {
      if (isSending) return; // Don't interrupt an in-flight response
      CompanionDisplay.showResponse({
        dialogue: data.dialogue,
        emotion: data.emotion,
        thoughts: data.thoughts,
        source: 'claude',
      });
      SourceIndicator.update('claude');
    });
  }

  async function saveChat() {
    const btn = document.getElementById('btn-save-chat');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ SAVING...'; }
    try {
      const result = await window.claudeAPI.saveConversation();
      _showToast(result.success
        ? 'Conversation saved to memory!'
        : `Save failed: ${result.error || 'unknown error'}`);
    } catch (err) {
      _showToast(`Error: ${err.message}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 SAVE CHAT'; }
    }
  }

  function _showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
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
          emotionalState: response.emotionalState || null,
        });

        // Update source indicator
        SourceIndicator.update(response.source);

        lastResponseSource = response.source;

        // If it was a filler or local, hide loading immediately
        if (response.source !== 'claude') {
          loadingEl.classList.add('hidden');
        }

        // Clear emotion after each send
        EmotionPicker.clear();

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
