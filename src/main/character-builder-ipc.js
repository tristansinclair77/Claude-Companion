/**
 * Character Builder IPC Handlers
 * Provides load/save/image-pick operations for the character builder window.
 */

const { ipcMain, BrowserWindow, dialog } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHARACTERS_BASE = path.join(__dirname, '../../characters');

let builderWindow = null;

// ── Window ─────────────────────────────────────────────────────────────────────

function createBuilderWindow(parentWindow) {
  if (builderWindow && !builderWindow.isDestroyed()) {
    builderWindow.focus();
    return;
  }

  builderWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    parent: parentWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/character-builder-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: 'Character Builder',
  });

  builderWindow.loadFile(path.join(__dirname, '../renderer/character-builder.html'));
  builderWindow.once('ready-to-show', () => builderWindow.show());
  builderWindow.on('closed', () => { builderWindow = null; });
}

// ── Image Helpers ──────────────────────────────────────────────────────────────

function imageToDataUrl(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) return null;
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase().slice(1);
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return null; }
}

// Returns { base: { emotionId: { filePath, dataUrl } }, combined: { ... } }
function loadEmotionImages(characterDir) {
  const emotionsDir = path.join(characterDir, 'emotions');
  const combinedDir = path.join(emotionsDir, 'combined');
  const result = { base: {}, combined: {} };

  if (fs.existsSync(emotionsDir)) {
    const files = fs.readdirSync(emotionsDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    for (const file of files) {
      const emotionId = path.basename(file, path.extname(file));
      const filePath = path.join(emotionsDir, file);
      result.base[emotionId] = { filePath, dataUrl: null }; // dataUrl loaded lazily
    }
  }

  if (fs.existsSync(combinedDir)) {
    const files = fs.readdirSync(combinedDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    for (const file of files) {
      const emotionId = path.basename(file, path.extname(file));
      const filePath = path.join(combinedDir, file);
      result.combined[emotionId] = { filePath, dataUrl: null };
    }
  }

  return result;
}

// ── IPC Registration ───────────────────────────────────────────────────────────

function registerCharacterBuilderIPC(mainWindow) {
  ipcMain.on('character-builder:open', () => {
    createBuilderWindow(mainWindow);
  });

  ipcMain.on('character-builder:minimize', () => builderWindow?.minimize());
  ipcMain.on('character-builder:maximize', () => {
    builderWindow?.isMaximized() ? builderWindow.unmaximize() : builderWindow?.maximize();
  });
  ipcMain.on('character-builder:close', () => builderWindow?.destroy());

  // Load character from a directory the user picks
  ipcMain.handle('character-builder:load', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Character Directory',
      defaultPath: CHARACTERS_BASE,
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

    const characterDir = result.filePaths[0];

    let character = {};
    let rules = { character: '', version: '1.0.0', rules: [] };
    let fillerResponses = {};
    let appearance = {};

    try {
      const p = path.join(characterDir, 'character.json');
      if (fs.existsSync(p)) character = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const p = path.join(characterDir, 'rules.json');
      if (fs.existsSync(p)) rules = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const p = path.join(characterDir, 'filler-responses.json');
      if (fs.existsSync(p)) fillerResponses = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const appFile = character.appearance_file || 'appearance.json';
      const p = path.join(characterDir, appFile);
      if (fs.existsSync(p)) appearance = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    const emotionImages = loadEmotionImages(characterDir);

    return { success: true, characterDir, character, rules, fillerResponses, appearance, emotionImages };
  });

  // Pick a single image file
  ipcMain.handle('character-builder:pick-image', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };
    const filePath = result.filePaths[0];
    const dataUrl = imageToDataUrl(filePath);
    return { success: true, filePath, dataUrl };
  });

  // Pick a directory to save a new character into
  ipcMain.handle('character-builder:pick-save-dir', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose folder to save character into (create new folder here)',
      defaultPath: CHARACTERS_BASE,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };
    return { success: true, dirPath: result.filePaths[0] };
  });

  // Read a single image as base64 data URL (lazy portrait loading)
  ipcMain.handle('character-builder:read-image', (event, filePath) => {
    const dataUrl = imageToDataUrl(filePath);
    return { success: !!dataUrl, dataUrl };
  });

  // ── Wizard: ask Claude to suggest a value for a single field ─────────────
  ipcMain.handle('character-builder:ask-claude', async (event, payload) => {
    try {
      const { field, userDescription, characterContext, emotionOptions, imagePaths = [] } = payload;

      // Build context summary
      const ctxLines = [];
      // Identity
      if (characterContext.name)                ctxLines.push(`Name: ${characterContext.name}`);
      if (characterContext.full_name)           ctxLines.push(`Full name: ${characterContext.full_name}`);
      if (characterContext.age_appearance)      ctxLines.push(`Appears: ${characterContext.age_appearance}`);
      if (characterContext.personality_summary) ctxLines.push(`Personality: ${characterContext.personality_summary}`);
      if (characterContext.speech_style)        ctxLines.push(`Speech: ${characterContext.speech_style}`);
      if (characterContext.backstory)           ctxLines.push(`Backstory: ${characterContext.backstory}`);
      if (characterContext.likes?.length)       ctxLines.push(`Likes: ${characterContext.likes.join(', ')}`);
      if (characterContext.dislikes?.length)    ctxLines.push(`Dislikes: ${characterContext.dislikes.join(', ')}`);
      if (characterContext.quirks?.length)      ctxLines.push(`Quirks: ${characterContext.quirks.join(', ')}`);
      // Appearance — Physical
      if (characterContext.height)      ctxLines.push(`Height: ${characterContext.height}`);
      if (characterContext.build)       ctxLines.push(`Build: ${characterContext.build}`);
      if (characterContext.hair)        ctxLines.push(`Hair: ${characterContext.hair}`);
      if (characterContext.eyes)        ctxLines.push(`Eyes: ${characterContext.eyes}`);
      if (characterContext.skin)        ctxLines.push(`Skin: ${characterContext.skin}`);
      if (characterContext.face)        ctxLines.push(`Face: ${characterContext.face}`);
      if (characterContext.self_desc)   ctxLines.push(`Self-description (in character's voice): ${characterContext.self_desc}`);
      // Appearance — Outfit
      if (characterContext.outfit_top)     ctxLines.push(`Outfit (top): ${characterContext.outfit_top}`);
      if (characterContext.outfit_harness) ctxLines.push(`Outfit (outer layer): ${characterContext.outfit_harness}`);
      if (characterContext.outfit_tie)     ctxLines.push(`Outfit (neck): ${characterContext.outfit_tie}`);
      if (characterContext.outfit_bottoms) ctxLines.push(`Outfit (bottoms): ${characterContext.outfit_bottoms}`);
      if (characterContext.outfit_legwear) ctxLines.push(`Outfit (legwear): ${characterContext.outfit_legwear}`);
      if (characterContext.outfit_boots)   ctxLines.push(`Outfit (footwear): ${characterContext.outfit_boots}`);
      if (characterContext.outfit_gloves)  ctxLines.push(`Outfit (gloves): ${characterContext.outfit_gloves}`);
      // Appearance — Accessories
      if (characterContext.acc_headset) ctxLines.push(`Accessory (head): ${characterContext.acc_headset}`);
      if (characterContext.acc_harness) ctxLines.push(`Accessory (harness): ${characterContext.acc_harness}`);
      // Appearance — Colors
      if (characterContext.col_primary)   ctxLines.push(`Color (primary): ${characterContext.col_primary}`);
      if (characterContext.col_secondary) ctxLines.push(`Color (secondary): ${characterContext.col_secondary}`);
      if (characterContext.col_tech)      ctxLines.push(`Color (tech accent): ${characterContext.col_tech}`);
      if (characterContext.col_identity)  ctxLines.push(`Color (identity): ${characterContext.col_identity}`);
      if (characterContext.col_hair)      ctxLines.push(`Hair color: ${characterContext.col_hair}`);
      if (characterContext.col_eyes)      ctxLines.push(`Eye color: ${characterContext.col_eyes}`);

      const contextStr = ctxLines.length > 0 ? ctxLines.join('\n') : '(no character info yet)';

      // Type-specific output instructions
      let outputInstructions = '';
      if (field.type === 'select') {
        outputInstructions = `\nValid emotion IDs: ${emotionOptions.join(', ')}\nRespond with ONLY one valid emotion ID from this list. No other text.`;
      } else if (field.type === 'list' || field.type === 'list-multiline') {
        outputInstructions = '\nRespond with ONLY a valid JSON array of strings. No markdown, no explanation.';
      } else if (field.type === 'filler') {
        outputInstructions = `\nRespond with ONLY a valid JSON object for filler-responses.json.\nStructure: { "categoryKey": { "triggers": [...], "responses": [{ "dialogue": "...", "thoughts": "...", "emotion": "..." }, ...] } }\nValid emotion IDs: ${emotionOptions.join(', ')}\nNo markdown code fences, no explanation — raw JSON only.`;
      } else if (field.type === 'personality-generate') {
        outputInstructions = '\nRespond with ONLY a valid JSON object: { "personality_summary": "...", "speech_style": "..." }\nBoth values should be detailed multi-sentence paragraphs. No markdown code fences, no explanation — raw JSON only.';
      } else if (imagePaths.length > 0) {
        outputInstructions = '\nReference image(s) are attached — use them as visual context to inform your answer, but follow the field description and context above to determine the correct format, voice, and perspective.\nRespond with ONLY the value for this field. No preamble, no quotes around the entire response, no explanation.';
      } else {
        outputInstructions = '\nRespond with ONLY the value for this field. No preamble, no quotes around the entire response, no explanation.';
      }

      const prompt =
`You are helping a user fill out a character sheet for an AI companion app.

CHARACTER INFO SO FAR:
${contextStr}

FIELD: ${field.label}
DESCRIPTION: ${field.description}${field.aiHint ? `\nCONTEXT: ${field.aiHint}` : ''}

USER REQUEST: ${userDescription}
${outputInstructions}`;

      const value = await callWizardClaude(prompt, imagePaths);
      return { success: true, value };
    } catch (err) {
      console.error('[WizardClaude] Error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Save character to disk
  ipcMain.handle('character-builder:save', async (event, data) => {
    try {
      const { characterDir, character, rules, fillerResponses, appearance, emotionImages, combinedEmotionImages } = data;
      if (!characterDir) return { success: false, error: 'No save directory specified.' };

      fs.mkdirSync(characterDir, { recursive: true });

      fs.writeFileSync(path.join(characterDir, 'character.json'), JSON.stringify(character, null, 2), 'utf-8');
      fs.writeFileSync(path.join(characterDir, 'rules.json'), JSON.stringify(rules, null, 2), 'utf-8');
      fs.writeFileSync(path.join(characterDir, 'filler-responses.json'), JSON.stringify(fillerResponses, null, 2), 'utf-8');

      const appearanceFile = character.appearance_file || 'appearance.json';
      if (Object.keys(appearance).length > 0) {
        fs.writeFileSync(path.join(characterDir, appearanceFile), JSON.stringify(appearance, null, 2), 'utf-8');
      }

      // Copy/save emotion images
      const emotionsDir = path.join(characterDir, 'emotions');
      fs.mkdirSync(emotionsDir, { recursive: true });

      if (emotionImages) {
        for (const [emotionId, filePath] of Object.entries(emotionImages)) {
          if (!filePath) continue;
          const destFile = path.join(emotionsDir, `${emotionId}.png`);
          try {
            if (path.resolve(filePath) !== path.resolve(destFile)) {
              fs.copyFileSync(filePath, destFile);
            }
          } catch (e) {
            console.warn(`[CharBuilder] Could not copy image for ${emotionId}:`, e.message);
          }
        }
      }

      if (combinedEmotionImages) {
        const combinedDir = path.join(emotionsDir, 'combined');
        fs.mkdirSync(combinedDir, { recursive: true });
        for (const [emotionId, filePath] of Object.entries(combinedEmotionImages)) {
          if (!filePath) continue;
          const destFile = path.join(combinedDir, `${emotionId}.png`);
          try {
            if (path.resolve(filePath) !== path.resolve(destFile)) {
              fs.copyFileSync(filePath, destFile);
            }
          } catch (e) {
            console.warn(`[CharBuilder] Could not copy combined image for ${emotionId}:`, e.message);
          }
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ── Claude CLI helper (wizard only) ────────────────────────────────────────
// Lightweight Claude call used exclusively by the character builder wizard.
// Uses the same CLI resolution strategy as claude-bridge.js.

let _wizardClaudeSpawn = null;

function resolveWizardClaude() {
  if (_wizardClaudeSpawn) return _wizardClaudeSpawn;
  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where claude.cmd', { shell: true })
        .toString().trim().split(/\r?\n/)[0].trim();
      const cmdDir = path.dirname(cmdPath);
      const scriptPath = path.join(cmdDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (fs.existsSync(scriptPath)) {
        _wizardClaudeSpawn = { cmd: 'node', prefix: [scriptPath], shell: false };
        return _wizardClaudeSpawn;
      }
    } catch (e) {
      console.warn('[WizardClaude] Could not resolve CLI script:', e.message);
    }
    _wizardClaudeSpawn = { cmd: 'claude.cmd', prefix: [], shell: true };
  } else {
    _wizardClaudeSpawn = { cmd: 'claude', prefix: [], shell: false };
  }
  return _wizardClaudeSpawn;
}

/**
 * Call Claude CLI for a single wizard field suggestion.
 *
 * Uses the same invocation pattern as claude-bridge.js:
 *  - stream-json via stdin (avoids Windows 32 767-char arg limit for long prompts)
 *  - claude-haiku-4-5-20251001 (fast, cheap)
 *  - --dangerously-skip-permissions (required in non-interactive/no-terminal mode)
 *  - Images embedded in the stream-json content array
 *
 * @param {string}   prompt      - Full prompt text
 * @param {string[]} imagePaths  - Optional image file paths to attach
 * @returns {Promise<string>}    - Raw text result from Claude
 */
function callWizardClaude(prompt, imagePaths = []) {
  return new Promise((resolve, reject) => {
    const { cmd, prefix, shell } = resolveWizardClaude();

    const args = [
      ...prefix,
      '--input-format',  'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-haiku-4-5-20251001',
      '--dangerously-skip-permissions',
    ];

    // Strip all Electron/VSCode env vars that confuse the Claude CLI subprocess
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ASAR;
    delete env.ELECTRON_RESOURCES_PATH;
    delete env.VSCODE_PID;
    delete env.VSCODE_IPC_HOOK;
    delete env.VSCODE_HANDLES_UNCAUGHT_ERRORS;
    delete env.VSCODE_NLS_CONFIG;

    const proc = spawn(cmd, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    // Suppress EPIPE on stdin (fires if process exits before we finish writing)
    proc.stdin.on('error', () => {});

    // Build the message content array — text prompt + any images
    const content = [{ type: 'text', text: prompt }];
    for (const imgPath of imagePaths) {
      if (imgPath && fs.existsSync(imgPath)) {
        try {
          const imgBase64 = fs.readFileSync(imgPath).toString('base64');
          const ext = path.extname(imgPath).toLowerCase().slice(1);
          const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
          content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: imgBase64 } });
        } catch (e) {
          console.warn('[WizardClaude] Could not read image:', imgPath, e.message);
        }
      }
    }

    const msg = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
    proc.stdin.write(msg, () => proc.stdin.end());

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('Claude wizard request timed out after 3 minutes'));
    }, 180000);

    proc.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout) {
        reject(new Error(`Claude exited ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      // Parse stream-json output — scan all lines, last wins
      const lines = stdout.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const obj = JSON.parse(lines[i]);
          if (obj.result)  { resolve(String(obj.result));  return; }
          if (obj.content) { resolve(String(obj.content)); return; }
          if (obj.type === 'assistant' && obj.message?.content) {
            const textPart = obj.message.content.find(c => c.type === 'text');
            if (textPart) { resolve(textPart.text); return; }
          }
        } catch {}
      }
      // Fallback: return raw stdout
      resolve(stdout.trim());
    });

    proc.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = { registerCharacterBuilderIPC };
