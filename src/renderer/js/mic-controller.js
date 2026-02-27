'use strict';
// Microphone controller — toggles recording, shows visual indicator.
// v1: Records audio but transcription is placeholder ("coming soon").
// Triggered by F2 hotkey (from main) or mic button click.

var MicController = (() => {
  const btnMic = document.getElementById('btn-mic');

  let mediaRecorder = null;
  let isRecording = false;
  let onTranscriptCallback = null;
  let chunks = [];

  function init(onTranscript) {
    onTranscriptCallback = onTranscript;
    btnMic.addEventListener('click', toggle);

    // Listen for hotkey:mic-toggle from main process
    window.claudeAPI.on('hotkey:mic-toggle', toggle);
  }

  async function toggle() {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        handleRecording(chunks);
      };

      mediaRecorder.start();
      isRecording = true;

      btnMic.textContent = '🔴 REC...';
      btnMic.classList.add('active', 'recording');
    } catch (err) {
      showToast('❌ Mic access denied: ' + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      btnMic.textContent = '🎤 MIC';
      btnMic.classList.remove('active', 'recording');
    }
  }

  function handleRecording(recordedChunks) {
    // v1: transcription not yet implemented
    // v2: pass to Whisper via @xenova/transformers
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    console.log('[MicController] Recording complete:', blob.size, 'bytes');

    // For now, show placeholder message
    showToast('🎤 Transcription coming soon — type your message for now');

    // v2 hook: if (onTranscriptCallback && transcript) onTranscriptCallback(transcript);
  }

  function getIsRecording() {
    return isRecording;
  }

  return { init, toggle, getIsRecording };
})();
