'use strict';
// Screen capture UI — manual button and auto-trigger detection.

var ScreenCaptureUI = (() => {
  const btnScreen = document.getElementById('btn-screen');

  function init() {
    btnScreen.addEventListener('click', manualCapture);
  }

  async function manualCapture() {
    btnScreen.disabled = true;
    btnScreen.textContent = '👁 CAPTURING...';

    try {
      const result = await window.claudeAPI.captureScreen();
      if (result && result.success) {
        FileAttach.addScreenshot(result.path);
        showToast('📸 Screen captured');
      } else {
        showToast('❌ Capture failed: ' + (result.error || 'unknown'));
      }
    } catch (err) {
      showToast('❌ Capture error: ' + err.message);
    } finally {
      btnScreen.disabled = false;
      btnScreen.textContent = '👁 SCREEN';
    }
  }

  /**
   * Checks if the user's message contains a visual trigger.
   * If so, auto-captures and adds to attachments.
   * @param {string} message
   * @returns {Promise<boolean>} true if auto-capture happened
   */
  async function checkAndAutoCapture(message) {
    try {
      const { needsCapture } = await window.claudeAPI.checkVisualTrigger(message);
      if (needsCapture) {
        const result = await window.claudeAPI.captureScreen();
        if (result && result.success) {
          FileAttach.addScreenshot(result.path);
          showToast('📸 Screen captured automatically');
          return true;
        }
      }
    } catch {}
    return false;
  }

  return { init, manualCapture, checkAndAutoCapture };
})();

// ── Toast helper (used by multiple modules) ───────────────────────────────────
function showToast(message, durationMs = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  // Re-trigger animation
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  setTimeout(() => toast.classList.add('hidden'), durationMs);
}
