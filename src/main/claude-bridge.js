// Spawns claude.cmd CLI and manages the communication channel.
// Every call is a FRESH session — full context injected as the prompt.

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildSystemPrompt, formatConversationWindow } = require('../shared/system-prompt');
const { parseResponse } = require('../shared/response-parser');

const DEFAULT_TIMEOUT_MS = 120000; // 120 seconds

// ── Claude CLI resolver ────────────────────────────────────────────────────────
// On Windows, .cmd files cannot be spawned without shell:true, but shell:true
// mangles multi-line arguments (the system prompt, user message).
// Fix: detect the real Node.js entry point (cli.js) and spawn `node cli.js`
// directly — bypasses the .cmd wrapper entirely.

let _resolved = null;

function resolveClaudeSpawn() {
  if (_resolved) return _resolved;

  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where claude.cmd', { shell: true })
        .toString().trim().split(/\r?\n/)[0].trim();
      const cmdDir = path.dirname(cmdPath);
      const scriptPath = path.join(cmdDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (fs.existsSync(scriptPath)) {
        _resolved = { cmd: 'node', prefix: [scriptPath] };
        console.log('[ClaudeBridge] Resolved claude CLI:', scriptPath);
        return _resolved;
      }
    } catch (e) {
      console.warn('[ClaudeBridge] Could not auto-resolve claude script:', e.message);
    }
    // Fallback: use shell:true with claude.cmd
    _resolved = { cmd: 'claude.cmd', prefix: [], shell: true };
  } else {
    _resolved = { cmd: 'claude', prefix: [], shell: false };
  }
  return _resolved;
}

/**
 * Sends a message to Claude CLI and returns the parsed response.
 *
 * @param {object} opts
 * @param {string} opts.userMessage       - The user's message
 * @param {object} opts.character         - Parsed character.json
 * @param {object} opts.characterRules    - Parsed rules.json
 * @param {string} [opts.masterSummary]
 * @param {Array}  [opts.permanentMemories]
 * @param {string} [opts.userProfile]
 * @param {Array}  [opts.conversationWindow] - Array of {role, content} messages
 * @param {string} [opts.detectedEmotion] - User's detected emotion
 * @param {Array}  [opts.attachments]     - Array of file paths to include as context
 * @returns {Promise<{dialogue, thoughts, emotion, memories, raw}>}
 */
async function sendToClaude({
  userMessage,
  character,
  characterRules,
  masterSummary = '',
  permanentMemories = [],
  userProfile = '',
  conversationWindow = [],
  detectedEmotion = '',
  attachments = [],
  relatedContext = [],
}) {
  const systemPrompt = buildSystemPrompt({
    character,
    characterRules,
    masterSummary,
    permanentMemories,
    userProfile,
  });

  // Build the full user prompt: conversation window + current message
  const windowText = formatConversationWindow(conversationWindow);
  let fullPrompt = '';

  if (windowText) {
    fullPrompt += `=== CURRENT CONVERSATION ===\n${windowText}\n=== END CURRENT CONVERSATION ===\n\n`;
  }

  if (detectedEmotion) {
    fullPrompt += `[Context: The user appears to be feeling ${detectedEmotion}.]\n\n`;
  }

  // Inject recalled past Q&A on related topics (RAG boost)
  if (relatedContext && relatedContext.length > 0) {
    const snippets = relatedContext
      .map((r) => `  Q: "${r.input_text}"\n  A: "${r.response_dialogue.slice(0, 400)}${r.response_dialogue.length > 400 ? '…' : ''}"`)
      .join('\n');
    fullPrompt += `=== RECALLED RELEVANT PAST EXCHANGES ===\n${snippets}\n=== END RECALLED CONTEXT ===\n\n`;
  }

  // Collect screenshot attachments separately — sent as image data via stdin
  const screenshotAtts = attachments.filter(
    (a) => a.type === 'screenshot' && a.path && fs.existsSync(a.path)
  );
  const hasScreenshot = screenshotAtts.length > 0;

  // Add attachment context (text-based)
  for (const att of attachments) {
    if (att.type === 'file' && att.content) {
      fullPrompt += `[Attached file: ${att.name}]\n\`\`\`\n${att.content.slice(0, 10000)}\n\`\`\`\n\n`;
    } else if (att.type === 'folder' && att.content) {
      fullPrompt += `[Attached folder: ${att.path}]\n${att.content.slice(0, 20000)}\n\n`;
    } else if (att.type === 'screenshot') {
      // Actual image data is injected via stream-json stdin below — skip text placeholder
    } else if (att.type === 'url' && att.content) {
      fullPrompt += `[Web page content from ${att.url}]\n${att.content.slice(0, 15000)}\n\n`;
    }
  }

  fullPrompt += `User: ${userMessage}`;

  return new Promise((resolve, reject) => {
    const { cmd, prefix, shell } = resolveClaudeSpawn();

    // When a screenshot is present, use stream-json stdin mode so we can pass
    // the image as base64. Otherwise use the simpler -p text mode.
    const args = hasScreenshot
      ? [
          ...prefix,
          '--input-format', 'stream-json',
          '--output-format', 'json',
          '--system-prompt', systemPrompt,
          '--dangerously-skip-permissions',
        ]
      : [
          ...prefix,
          '-p', fullPrompt,
          '--output-format', 'json',
          '--system-prompt', systemPrompt,
          '--dangerously-skip-permissions',
        ];

    // Strip Electron/VSCode env vars that can confuse the Claude CLI subprocess
    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.ELECTRON_NO_ASAR;
    delete cleanEnv.ELECTRON_RESOURCES_PATH;
    delete cleanEnv.VSCODE_PID;
    delete cleanEnv.VSCODE_IPC_HOOK;
    delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
    delete cleanEnv.VSCODE_NLS_CONFIG;

    const claudeProcess = spawn(cmd, args, {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    // Suppress EPIPE/write-EOF on stdin (fires if process exits before we finish writing)
    claudeProcess.stdin.on('error', (err) => {
      console.warn('[ClaudeBridge] stdin error (suppressed):', err.code || err.message);
    });

    // In stream-json mode, write the user message (with image data) to stdin
    if (hasScreenshot) {
      const content = [{ type: 'text', text: fullPrompt }];
      for (const att of screenshotAtts) {
        try {
          const imgBase64 = fs.readFileSync(att.path).toString('base64');
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imgBase64 },
          });
          console.log('[ClaudeBridge] Screenshot attached, base64 length:', imgBase64.length);
        } catch (err) {
          console.warn('[ClaudeBridge] Could not read screenshot:', err.message);
        }
      }
      // stream-json format wraps each message in a type envelope
      const msg = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
      claudeProcess.stdin.write(msg, () => claudeProcess.stdin.end());
    } else {
      claudeProcess.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    claudeProcess.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    claudeProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      // Log stderr in real-time so we can see what CLI is doing
      if (text.trim()) console.log('[ClaudeBridge stderr]', text.trim().slice(0, 200));
    });

    const timer = setTimeout(() => {
      claudeProcess.kill();
      const stderrSnip = stderr.slice(0, 600);
      reject(new Error(`Claude CLI timed out after ${DEFAULT_TIMEOUT_MS / 1000}s\nStderr: ${stderrSnip || '(none)'}`));
    }, DEFAULT_TIMEOUT_MS);

    claudeProcess.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0 && !stdout) {
        reject(new Error(`Claude CLI exited with code ${code}. Stderr: ${stderr.slice(0, 500)}`));
        return;
      }

      try {
        const raw = extractRawText(stdout);
        const parsed = parseResponse(raw);
        resolve({ ...parsed, raw });
      } catch (err) {
        // If JSON parse fails, try treating stdout as plain text
        const parsed = parseResponse(stdout.trim());
        resolve({ ...parsed, raw: stdout.trim() });
      }
    });

    claudeProcess.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });
  });
}

/**
 * Extracts the response text from Claude's JSON output.
 * Claude --output-format json returns: { type, subtype, cost_usd, result, ... }
 */
function extractRawText(stdout) {
  // Claude may output multiple JSON lines — get the last complete one
  const lines = stdout.trim().split('\n').filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      // The result field contains the actual response text
      if (obj.result) return obj.result;
      if (obj.content) return obj.content;
      if (obj.type === 'result' && obj.result) return obj.result;
    } catch {
      continue;
    }
  }

  // Fallback: return raw stdout
  return stdout.trim();
}

/**
 * Generates a session greeting from Claude (used on app startup).
 */
async function generateGreeting({ character, characterRules, masterSummary, permanentMemories }) {
  const greetMsg = masterSummary
    ? `Generate a warm, natural greeting as ${character.name}. Reference recent conversations naturally if appropriate (don't force it). Keep it brief — 1-2 sentences max.`
    : `Greet the user for the first time as ${character.name}. Use the character's greeting style.`;

  return sendToClaude({
    userMessage: greetMsg,
    character,
    characterRules,
    masterSummary,
    permanentMemories,
  });
}

module.exports = { sendToClaude, generateGreeting };
