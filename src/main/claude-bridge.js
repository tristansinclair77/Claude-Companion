// Spawns claude.cmd CLI and manages the communication channel.
// Every call is a FRESH session — full context injected as the prompt.

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildSystemPrompt, formatConversationWindow } = require('../shared/system-prompt');
const { parseResponse } = require('../shared/response-parser');
const logger = require('./debug-logger');

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
  emotionalState = null,
}) {
  const systemPrompt = buildSystemPrompt({
    character,
    characterRules,
    masterSummary,
    permanentMemories,
    userProfile,
    emotionalState,
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

  logger.log('claude_call', {
    systemPrompt,
    userPrompt: fullPrompt,
    memoriesInjected: permanentMemories,
    relatedContext,
    hasScreenshot,
    systemPromptLength: systemPrompt.length,
    userPromptLength: fullPrompt.length,
  });

  return new Promise((resolve, reject) => {
    const { cmd, prefix, shell } = resolveClaudeSpawn();

    // Always use stream-json stdin mode — the user prompt travels through the pipe
    // (no size limit) instead of as a -p CLI arg. This prevents ENAMETOOLONG on
    // Windows when the conversation window grows large.
    const args = [
      ...prefix,
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
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

    // Write user message via stdin — text prompt always included, screenshots appended if present
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
    const msg = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
    claudeProcess.stdin.write(msg, () => claudeProcess.stdin.end());

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
      const msg = `Claude CLI timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`;
      logger.log('error', { context: 'claude_timeout', message: msg, stderr: stderrSnip });
      reject(new Error(`${msg}\nStderr: ${stderrSnip || '(none)'}`));
    }, DEFAULT_TIMEOUT_MS);

    claudeProcess.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0 && !stdout) {
        const msg = `Claude CLI exited with code ${code}`;
        logger.log('error', { context: 'claude_exit', message: msg, stderr: stderr.slice(0, 500) });
        reject(new Error(`${msg}. Stderr: ${stderr.slice(0, 500)}`));
        return;
      }

      try {
        const raw = extractRawText(stdout);
        const parsed = parseResponse(raw);
        logger.log('claude_response', {
          raw,
          dialogue: parsed.dialogue,
          thoughts: parsed.thoughts,
          emotion: parsed.emotion,
          memoriesExtracted: parsed.memories,
          memoryUpdatesExtracted: parsed.memoryUpdates,
          selfFactsExtracted: parsed.selfFacts,
        });
        resolve({ ...parsed, raw });
      } catch (err) {
        // If JSON parse fails, try treating stdout as plain text
        const parsed = parseResponse(stdout.trim());
        logger.log('claude_response', {
          raw: stdout.trim(),
          dialogue: parsed.dialogue,
          thoughts: parsed.thoughts,
          emotion: parsed.emotion,
          memoriesExtracted: parsed.memories,
          memoryUpdatesExtracted: parsed.memoryUpdates,
          selfFactsExtracted: parsed.selfFacts,
          parseWarning: 'JSON parse failed, used raw stdout',
        });
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

/**
 * Generates a dense summary of a conversation for long-term memory storage.
 * Returns plain text — NOT the normal [DIALOGUE] response format.
 *
 * @param {Array}  opts.messages       - Array of {role, content} objects
 * @param {string} opts.characterName  - Companion's name (for labelling)
 * @returns {Promise<{summary: string}>}
 */
async function summarizeConversation({ messages, characterName }) {
  const convText = messages
    .map(m => `${m.role === 'user' ? 'User' : (characterName || 'Companion')}: ${m.content}`)
    .join('\n');

  const systemPrompt =
    'You are a conversation summarizer. Write a 3-5 sentence paragraph (plain text only, no tags or formatting) ' +
    'that summarizes the conversation you are shown. Write in third-person past tense. ' +
    'Capture: main topics discussed, any personal details the user shared, memorable moments, emotional tone. ' +
    'Output ONLY the summary paragraph and nothing else.';

  const userPrompt = `Summarize this conversation:\n\n${convText.slice(0, 12000)}`;

  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  return new Promise((resolve, reject) => {
    const args = [
      ...prefix,
      '-p', userPrompt,
      '--output-format', 'json',
      '--system-prompt', systemPrompt,
      '--dangerously-skip-permissions',
    ];

    const proc = spawn(cmd, args, {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Summarization timed out after 60s'));
    }, 60000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        reject(new Error(`Summarization failed (code ${code}): ${stderr.slice(0, 300)}`));
        return;
      }
      const raw = extractRawText(stdout) || stdout.trim();
      resolve({ summary: raw.trim() });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Claude for summarization: ${err.message}`));
    });
  });
}

/**
 * Scans a conversation transcript and extracts [MEMORY] and [SELF] facts using Claude.
 * Designed for retroactive memory extraction on old or saved sessions.
 *
 * @param {Array}  opts.messages      - Array of {role, content} objects
 * @param {string} opts.characterName - Companion's name
 * @returns {Promise<{memories: Array, selfFacts: Array, raw: string}>}
 */
async function extractMemories({ messages, characterName }) {
  const name = characterName || 'Aria';
  const convText = messages
    .map(m => `${m.role === 'user' ? 'User' : name}: ${m.content}`)
    .join('\n');

  const systemPrompt =
    `You are a memory extraction system for an AI companion named ${name}. ` +
    `Read the conversation carefully and extract every fact worth remembering for future sessions.\n\n` +
    `Rules:\n` +
    `- For each personal fact the USER shared (preferences, goals, feelings, life details, experiences, emotional reactions), output:\n` +
    `  [MEMORY] category: fact\n` +
    `- For each thing ${name} revealed about HERSELF (desires, fantasies, feelings toward user, dream scenarios, intimacy preferences, relationship dynamics she accepted, things she confessed wanting), output:\n` +
    `  [SELF] category: fact\n` +
    `- For relationship milestones (nicknames established, proposals or commitments, shared roleplay or fantasies, emotional moments where user cried or was deeply moved), output:\n` +
    `  [MEMORY] relationship: fact\n` +
    `- Be thorough. Extract all meaningful facts, including subtle or emotional ones.\n` +
    `- Output ONLY the memory tags, one per line. No explanation, no preamble, no other text.`;

  const userPrompt = `Extract all memories from this conversation:\n\n${convText.slice(0, 15000)}`;

  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  const rawText = await new Promise((resolve, reject) => {
    const args = [
      ...prefix,
      '-p', userPrompt,
      '--output-format', 'json',
      '--system-prompt', systemPrompt,
      '--dangerously-skip-permissions',
    ];

    const proc = spawn(cmd, args, {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Memory extraction timed out after 90s'));
    }, 90000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        reject(new Error(`Memory extraction failed (code ${code}): ${stderr.slice(0, 300)}`));
        return;
      }
      resolve(extractRawText(stdout) || stdout.trim());
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Claude for memory extraction: ${err.message}`));
    });
  });

  // Parse [MEMORY] tags
  const memories = [];
  const memRegex = /\[MEMORY\]\s*([^:]+):\s*(.+)/gi;
  let mm;
  while ((mm = memRegex.exec(rawText)) !== null) {
    memories.push({ category: mm[1].trim().toLowerCase(), content: mm[2].trim() });
  }

  // Parse [SELF] tags
  const selfFacts = [];
  const selfRegex = /\[SELF\]\s*([^:]+):\s*(.+)/gi;
  let ss;
  while ((ss = selfRegex.exec(rawText)) !== null) {
    selfFacts.push({ category: ss[1].trim().toLowerCase(), content: ss[2].trim() });
  }

  return { memories, selfFacts, raw: rawText };
}

module.exports = { sendToClaude, generateGreeting, summarizeConversation, extractMemories };
