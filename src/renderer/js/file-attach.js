'use strict';
// File and folder attachment UI — manages attachment bar and state.

var FileAttach = (() => {
  const bar  = document.getElementById('attachment-bar');
  const list = document.getElementById('attachment-list');

  let attachments = []; // Array of {type, name, path?, content?, url?}

  const IMAGE_EXTS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

  function init() {
    document.getElementById('btn-folder').addEventListener('click', openAttachDialog);
    initDragDrop();
  }

  function initDragDrop() {
    const inputArea = document.getElementById('input-area');

    // Prevent Electron from navigating the window when files are dropped anywhere
    document.addEventListener('dragover',  (e) => e.preventDefault());
    document.addEventListener('drop',      (e) => e.preventDefault());

    inputArea.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        inputArea.classList.add('drag-over');
      }
    });

    inputArea.addEventListener('dragleave', (e) => {
      if (!inputArea.contains(e.relatedTarget)) {
        inputArea.classList.remove('drag-over');
      }
    });

    inputArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inputArea.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        const mediaType = IMAGE_EXTS[ext];
        if (mediaType) {
          // Electron 32+: use webUtils.getPathForFile via preload (file.path was removed)
          const filePath = window.claudeAPI.getPathForFile(file);
          if (filePath) {
            addAttachment({ type: 'image', name: file.name, path: filePath, mediaType });
          }
        }
      }
    });
  }

  async function openAttachDialog() {
    const result = await window.claudeAPI.openFolder();
    if (result && result.success) {
      addAttachment({ type: result.type, name: result.name, path: result.path, content: result.content });
    } else {
      // Try file if folder cancelled
      const fileResult = await window.claudeAPI.openFile();
      if (fileResult && fileResult.success) {
        addAttachment({ type: fileResult.type, name: fileResult.name, path: fileResult.path, content: fileResult.content, mediaType: fileResult.mediaType });
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

      if (att.type === 'image') {
        const thumb = document.createElement('img');
        thumb.src = 'file://' + att.path.replace(/\\/g, '/');
        thumb.style.cssText = 'height:28px;width:28px;object-fit:cover;border-radius:2px;margin-right:4px;flex-shrink:0;';
        thumb.onerror = () => { thumb.style.display = 'none'; };
        chip.insertBefore(thumb, chip.firstChild);
      }

      const nameSpan = document.createElement('span');
      const typePrefix = att.type === 'image' ? 'Image: ' : att.type === 'screenshot' ? '' : '';
      nameSpan.textContent = typePrefix + att.name;
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
