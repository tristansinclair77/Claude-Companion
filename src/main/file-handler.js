// File and folder handling — dialogs, scanning, reading.

const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX_TOTAL_CHARS = 50000;
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
  '.html', '.css', '.scss', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp',
  '.h', '.hpp', '.sh', '.bat', '.env', '.gitignore', '.sql', '.xml', '.csv',
  '.toml', '.ini', '.cfg', '.conf', '.log',
]);

/**
 * Opens a file picker dialog and returns file path + content.
 * @param {BrowserWindow} win
 * @returns {Promise<{name, path, content, type: 'file'} | null>}
 */
async function openFilePicker(win) {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'md', 'js', 'ts', 'json', 'py', 'html', 'css', 'yaml', 'yml', 'toml', 'xml', 'csv', 'log'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = readFileContent(filePath);

  return {
    type: 'file',
    name: path.basename(filePath),
    path: filePath,
    content,
  };
}

/**
 * Opens a folder picker dialog and returns folder summary.
 * @param {BrowserWindow} win
 * @returns {Promise<{path, content, type: 'folder'} | null>}
 */
async function openFolderPicker(win) {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const folderPath = result.filePaths[0];
  const content = scanFolder(folderPath);

  return {
    type: 'folder',
    path: folderPath,
    name: path.basename(folderPath),
    content,
  };
}

/**
 * Reads a single file's content as text.
 */
function readFileContent(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext) && ext !== '') {
      return `[Binary file: ${path.basename(filePath)}]`;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw.slice(0, MAX_TOTAL_CHARS);
  } catch (err) {
    return `[Could not read file: ${err.message}]`;
  }
}

/**
 * Recursively scans a folder and returns a text summary.
 */
function scanFolder(folderPath, maxDepth = 3) {
  const files = [];
  let totalChars = 0;

  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(folderPath, fullPath);

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const isText = TEXT_EXTENSIONS.has(ext);
        const size = (() => { try { return fs.statSync(fullPath).size; } catch { return 0; } })();
        const sizeStr = size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`;
        files.push({ relPath, ext, isText, size, sizeStr, fullPath });
      }
    }
  }

  walk(folderPath, 0);

  let summary = `Folder: ${folderPath} (${files.length} files)\n\n`;

  // File tree
  for (const f of files.slice(0, 200)) {
    summary += `  ${f.relPath} (${f.sizeStr})\n`;
  }
  if (files.length > 200) summary += `  ... and ${files.length - 200} more files\n`;

  summary += '\n--- File Contents (text files, truncated) ---\n\n';

  for (const f of files) {
    if (!f.isText) continue;
    if (totalChars >= MAX_TOTAL_CHARS) break;
    try {
      const content = fs.readFileSync(f.fullPath, 'utf-8');
      const allowed = MAX_TOTAL_CHARS - totalChars;
      const excerpt = content.slice(0, Math.min(2000, allowed));
      summary += `\n// ${f.relPath}\n${excerpt}`;
      if (content.length > 2000) summary += '\n[... truncated ...]';
      summary += '\n';
      totalChars += excerpt.length;
    } catch {}
  }

  return summary.slice(0, MAX_TOTAL_CHARS + 2000);
}

module.exports = { openFilePicker, openFolderPicker, readFileContent, scanFolder };
