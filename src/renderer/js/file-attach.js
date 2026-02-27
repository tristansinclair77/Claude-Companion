'use strict';
// File and folder attachment UI — manages attachment bar and state.

var FileAttach = (() => {
  const bar  = document.getElementById('attachment-bar');
  const list = document.getElementById('attachment-list');

  let attachments = []; // Array of {type, name, path?, content?, url?}

  function init() {
    document.getElementById('btn-folder').addEventListener('click', openAttachDialog);
  }

  async function openAttachDialog() {
    const result = await window.claudeAPI.openFolder();
    if (result && result.success) {
      addAttachment({ type: result.type, name: result.name, path: result.path, content: result.content });
    } else {
      // Try file if folder cancelled
      const fileResult = await window.claudeAPI.openFile();
      if (fileResult && fileResult.success) {
        addAttachment({ type: fileResult.type, name: fileResult.name, path: fileResult.path, content: fileResult.content });
      }
    }
  }

  function addAttachment(att) {
    // Avoid duplicates
    if (attachments.find((a) => a.name === att.name && a.type === att.type)) return;
    attachments.push(att);
    render();
  }

  function addScreenshot(screenshotPath) {
    // Remove previous screenshot if any
    attachments = attachments.filter((a) => a.type !== 'screenshot');
    attachments.push({
      type: 'screenshot',
      name: '📸 Screenshot',
      path: screenshotPath,
    });
    render();
  }

  function addUrlContent(url, title, content) {
    attachments = attachments.filter((a) => !(a.type === 'url' && a.url === url));
    attachments.push({ type: 'url', name: title || url, url, content });
    render();
  }

  function removeAttachment(index) {
    attachments.splice(index, 1);
    render();
  }

  function render() {
    list.innerHTML = '';
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.title = att.path || att.url || att.name;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = att.name;
      nameSpan.style.overflow = 'hidden';
      nameSpan.style.textOverflow = 'ellipsis';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => removeAttachment(i));

      chip.appendChild(nameSpan);
      chip.appendChild(removeBtn);
      list.appendChild(chip);
    }

    if (attachments.length > 0) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  function getAttachments() {
    return [...attachments];
  }

  function clear() {
    attachments = [];
    render();
  }

  return { init, addAttachment, addScreenshot, addUrlContent, getAttachments, clear };
})();
