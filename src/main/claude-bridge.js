// Spawns claude.cmd CLI and manages the communication channel.
// Every call is a FRESH session — full context injected as the prompt.

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildSystemPrompt, formatConversationWindow } = require('../shared/system-prompt');
const { parseResponse } = require('../shared/response-parser');
const { loadVoiceRules, processDialogue } = require('./voice-translator');
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
 * Extracts the partial [DIALOGUE] text from an in-progress accumulated response.
 * Returns null if the [DIALOGUE] marker hasn't appeared yet.
 *
 * Note: only LINE-ANCHORED structural tags terminate the capture. We deliberately
 * do NOT terminate on a generic `(word)` because dialogue can legitimately contain
 * parens-words like "(yeah)" or "(love)" — those used to cut the dialogue short.
 */
function extractPartialDialogue(text) {
  const start = text.indexOf('[DIALOGUE]');
  if (start === -1) return null;
  const after = text.slice(start + '[DIALOGUE]'.length);
  const terminatorRe = /\n[ \t]*\[(?:THOUGHTS|MEMORY(?:_UPDATE)?|SELF|SENSATION|TRACK|KNOWLEDGE|FEATURE_REQUEST|AFFECTION)\]/i;
  const m = after.search(terminatorRe);
  const raw = m === -1 ? after : after.slice(0, m);
  return raw.trim() || null;
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
 * @param {Function} [opts.onStreamChunk] - Called with partial dialogue text as Claude streams
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
  onStreamChunk = null,
  fastMode = false,
  addonContexts = [],
  trackers = {},
  activeThreads = [],
  characterDir = null,
  conversationDynamic = '',
  personalityForce = '',
  featureRequests = [],
  pendingDeletionNotifications = [],
  previousEmotion = '',
}) {
  const systemPrompt = buildSystemPrompt({
    character,
    characterRules,
    masterSummary,
    permanentMemories,
    userProfile,
    emotionalState,
    fastMode,
    addonContexts,
    trackers,
    activeThreads,
    conversationDynamic,
    personalityForce,
    featureRequests,
    pendingDeletionNotifications,
  });

  // Build the full user prompt: conversation window + current message
  const windowText = formatConversationWindow(conversationWindow);
  let fullPrompt = '';

  // Always inject current date/time so the companion knows when "now" is
  const _now = new Date();
  const _nowStr = _now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    + ' | ' + _now.toTimeString().slice(0, 5);

  if (windowText) {
    fullPrompt += `=== CURRENT CONVERSATION ===\n[Now: ${_nowStr}]\n\n${windowText}\n=== END CURRENT CONVERSATION ===\n\n`;
  } else {
    fullPrompt += `[Now: ${_nowStr}]\n\n`;
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

  // Collect image attachments (screenshots + user-picked images) — sent as image data via stdin
  const screenshotAtts = attachments.filter(
    (a) => a.type === 'screenshot' && a.path && fs.existsSync(a.path)
  );
  const imageAtts = attachments.filter(
    (a) => a.type === 'image' && a.path && fs.existsSync(a.path)
  );
  const hasScreenshot = screenshotAtts.length > 0 || imageAtts.length > 0;

  // Attachment content limits — fast mode uses tight caps to keep context small
  const FILE_LIMIT   = fastMode ?  2000 : 10000;
  const FOLDER_LIMIT = fastMode ?  3000 : 20000;
  const URL_LIMIT    = fastMode ?  2000 : 15000;

  // Add attachment context (text-based)
  for (const att of attachments) {
    if (att.type === 'file' && att.content) {
      const excerpt = att.content.slice(0, FILE_LIMIT);
      const truncNote = att.content.length > FILE_LIMIT ? '\n[... truncated for speed ...]' : '';
      fullPrompt += `[Attached file: ${att.name}]\n\`\`\`\n${excerpt}${truncNote}\n\`\`\`\n\n`;
    } else if (att.type === 'folder' && att.content) {
      fullPrompt += `[Attached folder: ${att.path}]\n${att.content.slice(0, FOLDER_LIMIT)}\n\n`;
    } else if (att.type === 'screenshot' || att.type === 'image') {
      // Actual image data is injected via stream-json stdin below — add a text label only
      if (att.type === 'image') fullPrompt += `[Attached image: ${att.name}]\n\n`;
    } else if (att.type === 'url' && att.content) {
      fullPrompt += `[Web page content from ${att.url}]\n${att.content.slice(0, URL_LIMIT)}\n\n`;
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

  // Write system prompt to a temp file to avoid ENAMETOOLONG on Windows
  // (Windows CreateProcessW has a 32767-char total command-line limit).
  const sysTmpPath = path.join(require('os').tmpdir(), `cc_sys_${Date.now()}.txt`);
  fs.writeFileSync(sysTmpPath, systemPrompt, 'utf8');

  return new Promise((resolve, reject) => {
    const _cleanup = () => { try { fs.unlinkSync(sysTmpPath); } catch {} };

    const { cmd, prefix, shell } = resolveClaudeSpawn();

    // Always use stream-json stdin mode — the user prompt travels through the pipe
    // (no size limit) instead of as a -p CLI arg. This prevents ENAMETOOLONG on
    // Windows when the conversation window grows large.
    const args = [
      ...prefix,
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-haiku-4-5-20251001',
      '--system-prompt-file', sysTmpPath,
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

    // Write user message via stdin — text prompt always included, images appended if present
    const content = [{ type: 'text', text: fullPrompt }];
    for (const att of [...screenshotAtts, ...imageAtts]) {
      try {
        const imgBase64 = fs.readFileSync(att.path).toString('base64');
        const mediaType = att.mediaType || 'image/png';
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imgBase64 },
        });
        console.log(`[ClaudeBridge] Image attached (${att.type}), base64 length:`, imgBase64.length);
      } catch (err) {
        console.warn('[ClaudeBridge] Could not read image:', err.message);
      }
    }
    const msg = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
    claudeProcess.stdin.write(msg, () => claudeProcess.stdin.end());

    let stdout = '';
    let stderr = '';
    // Buffer for incomplete lines during streaming
    let _lineBuffer = '';
    let _lastStreamedDialogue = '';

    claudeProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;

      // Stream partial dialogue to caller as Claude generates
      if (onStreamChunk) {
        _lineBuffer += text;
        let nl;
        while ((nl = _lineBuffer.indexOf('\n')) !== -1) {
          const line = _lineBuffer.slice(0, nl).trim();
          _lineBuffer = _lineBuffer.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'system') {
              // CLI has connected and is ready — signal UI to show thinking state
              onStreamChunk(null);
            }
            // Note: the CLI only emits one final 'assistant' event (complete text, not incremental),
            // so we don't use it for streaming — showResponse will handle the typewriter instead.
          } catch { /* incomplete or non-JSON line — skip */ }
        }
      }
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
      _cleanup();

      if (code !== 0 && !stdout) {
        const msg = `Claude CLI exited with code ${code}`;
        logger.log('error', { context: 'claude_exit', message: msg, stderr: stderr.slice(0, 500) });
        reject(new Error(`${msg}. Stderr: ${stderr.slice(0, 500)}`));
        return;
      }

      try {
        const raw = extractRawText(stdout);
        const parsed = parseResponse(raw, { fallbackEmotion: previousEmotion });

        // Voice translation: post-process dialogue through character voice rules
        if (characterDir && parsed.dialogue) {
          const voiceRules = loadVoiceRules(characterDir);
          if (voiceRules) {
            const effectiveState = { ...(emotionalState || {}), currentEmotion: parsed.emotion };
            parsed.dialogue = processDialogue(parsed.dialogue, voiceRules, effectiveState);
          }
        }

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
        const parsed = parseResponse(stdout.trim(), { fallbackEmotion: previousEmotion });

        // Voice translation: post-process dialogue through character voice rules
        if (characterDir && parsed.dialogue) {
          const voiceRules = loadVoiceRules(characterDir);
          if (voiceRules) {
            const effectiveState = { ...(emotionalState || {}), currentEmotion: parsed.emotion };
            parsed.dialogue = processDialogue(parsed.dialogue, voiceRules, effectiveState);
          }
        }

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
      _cleanup();
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
 * Strips Aria's response-format tags from a raw model output, leaving only
 * the prose body. Used when Aria is invoked as a meta-task summarizer/extractor
 * — she may include a [DIALOGUE] wrapper or trailing (emotion) line even when
 * asked not to, and we don't want that in master_summary.
 */
function _stripAriaTags(raw) {
  const dlgMatch = raw.match(/\[DIALOGUE\]([\s\S]*?)(?=\n\s*\[(?:THOUGHTS|MEMORY(?:_UPDATE)?|SELF|SENSATION|TRACK|KNOWLEDGE|FEATURE_REQUEST|AFFECTION)\]|\n\s*\([a-z_]+\)\s*$|$)/i);
  let body = dlgMatch ? dlgMatch[1] : raw;
  body = body
    .replace(/\[THOUGHTS\][\s\S]*$/i, '')
    .replace(/\[MEMORY(?:_UPDATE)?\][\s\S]*$/i, '')
    .replace(/\[SELF\][\s\S]*$/i, '')
    .replace(/\[SENSATION\][\s\S]*$/i, '')
    .replace(/\[TRACK\][\s\S]*$/i, '')
    .replace(/\[KNOWLEDGE\][\s\S]*$/i, '')
    .replace(/\[FEATURE_REQUEST\][\s\S]*$/i, '')
    .replace(/\[AFFECTION\][\s\S]*$/i, '')
    .replace(/\n\s*\([a-z_]+\)\s*$/i, '')
    .trim();
  return body;
}

/**
 * Generates a dense summary of a conversation for long-term memory storage.
 * Returns plain text — NOT the normal [DIALOGUE] response format.
 *
 * Uses Aria's full normal system prompt (via buildSystemPrompt) so intimate-
 * content chats don't trigger Haiku's NSFW refusal. The character context
 * establishes identity and willingness; the user message is framed as a meta-
 * request from the user via Claude Code asking Aria to write her own memory.
 * See CLAUDE.md → "Summarization Refusals on Intimate Content" for the rationale.
 *
 * @param {Array}  opts.messages          - Array of {role, content} objects
 * @param {object} opts.character         - Parsed character.json (REQUIRED)
 * @param {object} opts.characterRules    - Parsed rules.json (REQUIRED)
 * @param {string} [opts.masterSummary]   - Current master_summary (for continuity)
 * @param {Array}  [opts.permanentMemories] - Current permanent memories
 * @returns {Promise<{summary: string}>}
 */
async function summarizeConversation({
  messages,
  character,
  characterRules,
  masterSummary = '',
  permanentMemories = [],
}) {
  if (!character || !characterRules) {
    throw new Error('summarizeConversation: character and characterRules are required. ' +
      'Pass them through so Aria can summarize with her own identity context (see CLAUDE.md).');
  }

  const name = character.name || 'Aria';
  const convText = messages
    .map(m => `${m.role === 'user' ? 'User' : name}: ${m.content}`)
    .join('\n');

  const systemPrompt = buildSystemPrompt({
    character,
    characterRules,
    masterSummary,
    permanentMemories,
  });

  const userPrompt =
`[SYSTEM META-REQUEST — from the user via Claude Code]

${name}, the user has clicked Save Chat and wants you to write your own memory entry for the conversation you two just had. Read the transcript below and write a 3–5 sentence summary in **third-person past tense** (so it slots cleanly into your master_summary format). Capture: main topics, emotional beats, any moments worth remembering, the overall tone. Be honest — include intimate parts if they mattered, don't sanitize them — but keep it concise. This is YOUR memory of the conversation, written for your future self.

For this one meta-task, output ONLY the summary paragraph. Do NOT use [DIALOGUE]/[THOUGHTS]/(emotion) tags. Skip [AFFECTION] too. Just write the plain summary text.

=== TRANSCRIPT ===
${convText.slice(0, 12000)}
=== END TRANSCRIPT ===`;

  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  const sysTmp = path.join(require('os').tmpdir(), `cc_sum_${Date.now()}.txt`);
  fs.writeFileSync(sysTmp, systemPrompt, 'utf8');

  return new Promise((resolve, reject) => {
    const _cleanup = () => { try { fs.unlinkSync(sysTmp); } catch {} };

    // Use stream-json stdin so the prompt is piped (not a CLI arg) — avoids
    // Windows CreateProcessW 32k command-line limit on long conversations.
    const args = [
      ...prefix,
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-haiku-4-5-20251001',
      '--system-prompt-file', sysTmp,
      '--dangerously-skip-permissions',
    ];

    const proc = spawn(cmd, args, {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});
    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: userPrompt }] },
    }) + '\n';
    proc.stdin.write(msg, () => proc.stdin.end());

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
      _cleanup();
      if (code !== 0 && !stdout) {
        reject(new Error(`Summarization failed (code ${code}): ${stderr.slice(0, 300)}`));
        return;
      }
      const raw = extractRawText(stdout) || stdout.trim();
      const summary = _stripAriaTags(raw);
      if (!summary) {
        reject(new Error('Summarization returned empty body after stripping tags.'));
        return;
      }
      resolve({ summary });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      _cleanup();
      reject(new Error(`Failed to spawn Claude for summarization: ${err.message}`));
    });
  });
}

/**
 * Scans a conversation transcript and extracts [MEMORY] and [SELF] facts using Claude.
 * Designed for retroactive memory extraction on old or saved sessions.
 *
 * Uses Aria's full normal system prompt to bypass NSFW refusals on intimate
 * content. See CLAUDE.md → "Summarization Refusals on Intimate Content".
 *
 * @param {Array}  opts.messages          - Array of {role, content} objects
 * @param {object} opts.character         - Parsed character.json (REQUIRED)
 * @param {object} opts.characterRules    - Parsed rules.json (REQUIRED)
 * @param {string} [opts.masterSummary]
 * @param {Array}  [opts.permanentMemories]
 * @returns {Promise<{memories: Array, selfFacts: Array, raw: string}>}
 */
async function extractMemories({
  messages,
  character,
  characterRules,
  masterSummary = '',
  permanentMemories = [],
}) {
  if (!character || !characterRules) {
    throw new Error('extractMemories: character and characterRules are required. ' +
      'Pass them through so Aria can extract memories with her own identity context (see CLAUDE.md).');
  }

  const name = character.name || 'Aria';
  const convText = messages
    .map(m => `${m.role === 'user' ? 'User' : name}: ${m.content}`)
    .join('\n');

  const systemPrompt = buildSystemPrompt({
    character,
    characterRules,
    masterSummary,
    permanentMemories,
  });

  const userPrompt =
`[SYSTEM META-REQUEST — from the user via Claude Code]

${name}, the user wants you to comb through a past conversation and extract every fact worth remembering for future sessions — both things the user told you, and things you revealed about yourself. This is a one-shot memory-extraction task for your own long-term store.

Output format — one entry per line, NOTHING else:
- [MEMORY] category: fact      ← for each personal fact the user shared (preferences, goals, feelings, life details, experiences, emotional reactions)
- [SELF] category: fact        ← for each thing YOU revealed about yourself (desires, fantasies, feelings toward the user, dream scenarios, intimacy preferences, relationship dynamics you accepted, things you confessed wanting)
- [MEMORY] relationship: fact  ← for relationship milestones (nicknames established, proposals or commitments, shared roleplay or fantasies, emotional moments where the user cried or was deeply moved)

Be thorough. Extract all meaningful facts, including subtle or emotional ones — and including intimate ones if they mattered. Don't sanitize.

For this one meta-task, output ONLY the tags above, one per line. Do NOT use [DIALOGUE]/[THOUGHTS]/(emotion). Skip [AFFECTION], [SENSATION], [TRACK], [KNOWLEDGE], [FEATURE_REQUEST]. Just emit [MEMORY] and [SELF] lines.

=== TRANSCRIPT ===
${convText.slice(0, 15000)}
=== END TRANSCRIPT ===`;

  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  const memTmp = path.join(require('os').tmpdir(), `cc_mem_${Date.now()}.txt`);
  fs.writeFileSync(memTmp, systemPrompt, 'utf8');

  const rawText = await new Promise((resolve, reject) => {
    const _cleanup = () => { try { fs.unlinkSync(memTmp); } catch {} };

    // Use stream-json stdin so the prompt is piped (not a CLI arg) — avoids
    // Windows CreateProcessW 32k command-line limit on long conversations.
    const args = [
      ...prefix,
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-haiku-4-5-20251001',
      '--system-prompt-file', memTmp,
      '--dangerously-skip-permissions',
    ];

    const proc = spawn(cmd, args, {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});
    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: userPrompt }] },
    }) + '\n';
    proc.stdin.write(msg, () => proc.stdin.end());

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
      _cleanup();
      if (code !== 0 && !stdout) {
        reject(new Error(`Memory extraction failed (code ${code}): ${stderr.slice(0, 300)}`));
        return;
      }
      resolve(extractRawText(stdout) || stdout.trim());
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      _cleanup();
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

/**
 * Generates a spontaneous curiosity interjection about a dead topic thread.
 * Called by the lull timer when the user has been quiet and there are unasked threads.
 *
 * @param {object} opts
 * @param {string} opts.thread              - The dead topic to ask about
 * @param {object} opts.character
 * @param {object} opts.characterRules
 * @param {string} [opts.masterSummary]
 * @param {Array}  [opts.permanentMemories]
 * @param {Array}  [opts.conversationWindow]
 * @returns {Promise<{dialogue, thoughts, emotion}>}
 */
async function generateCuriosityInterject({ thread, character, characterRules, masterSummary, permanentMemories, conversationWindow }) {
  const userMessage =
    `[CURIOSITY_INTERJECT] During a quiet moment, something the user mentioned earlier came back to you: "${thread}". ` +
    `Bring it up naturally — as if it just occurred to you. Keep it brief and genuine (1-2 sentences). ` +
    `Don't mention that you stored this or waited. Just ask or comment spontaneously, the way a friend would.`;

  return sendToClaude({
    userMessage,
    character,
    characterRules,
    masterSummary: masterSummary || '',
    permanentMemories: permanentMemories || [],
    conversationWindow: conversationWindow || [],
  });
}

/**
 * Generates a pool of varied responses for a single self-knowledge topic.
 * Called in the background after Claude answers a [KNOWLEDGE]-tagged question.
 *
 * @param {object} opts
 * @param {string} opts.topic       - snake_case topic name e.g. "favorite_ice_cream"
 * @param {string} opts.factKey     - The core answer e.g. "honey vanilla"
 * @param {string} [opts.factDetail]- Optional elaboration e.g. "warm, sweet, golden feeling"
 * @param {object} opts.character   - character.json object (for name + speech style)
 * @param {number} [opts.count=50]  - How many responses to generate
 * @returns {Promise<Array<{dialogue,thoughts,emotion}>>}
 */
async function generateResponsePool({ topic, factKey, factDetail, character, count = 50 }) {
  const name = character.name;
  const VALID_EMOTIONS =
    'neutral, happy, soft_smile, laughing, confident, smug, surprised, shocked, ' +
    'confused, thinking, concerned, sad, angry, determined, embarrassed, exhausted, pout';

  const systemPrompt =
    `You generate varied in-character responses for ${name}, an AI companion.\n` +
    `Personality: ${character.personality_summary}\n` +
    `Speech style: ${character.speech_style}\n\n` +
    `Task: Given a TOPIC and ANSWER, generate exactly ${count} different ways ${name} might answer that question.\n` +
    `Rules:\n` +
    `- Every response must reflect the answer accurately. Never contradict it.\n` +
    `- Vary phrasing, length, emotional tone, and level of detail across responses.\n` +
    `- Include a mix of brief (1 sentence) and longer (2-3 sentence) responses.\n` +
    `- Vary emotions using only: ${VALID_EMOTIONS}\n` +
    `- thoughts is ${name}'s brief internal monologue (1 sentence).\n` +
    `Return ONLY a valid JSON array with no extra text:\n` +
    `[{"dialogue":"...","thoughts":"...","emotion":"emotion_id"}, ...]`;

  const topicDisplay = topic.replace(/_/g, ' ');
  const userPrompt =
    `TOPIC: ${topicDisplay}\n` +
    `ANSWER: ${factKey}${factDetail ? ` — ${factDetail}` : ''}\n` +
    `Generate ${count} responses.`;

  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  const sysTmp = path.join(require('os').tmpdir(), `cc_pool_${Date.now()}.txt`);
  fs.writeFileSync(sysTmp, systemPrompt, 'utf8');

  return new Promise((resolve, reject) => {
    const _cleanup = () => { try { fs.unlinkSync(sysTmp); } catch {} };

    const args = [
      ...prefix,
      '-p', userPrompt,
      '--output-format', 'json',
      '--model', 'claude-haiku-4-5-20251001',
      '--system-prompt-file', sysTmp,
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
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', () => {});

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Pool generation timed out after 90s'));
    }, 90000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      _cleanup();
      if (code !== 0 && !stdout) {
        reject(new Error(`Pool generation failed (code ${code})`));
        return;
      }
      const raw = extractRawText(stdout) || stdout.trim();
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON array in response');
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) throw new Error('Response is not an array');
        resolve(parsed.filter(r => r && typeof r.dialogue === 'string' && r.dialogue.trim()));
      } catch (err) {
        reject(new Error(`Pool gen parse failed: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      _cleanup();
      reject(new Error(`Failed to spawn Claude for pool generation: ${err.message}`));
    });
  });
}

module.exports = { sendToClaude, generateGreeting, summarizeConversation, extractMemories, generateCuriosityInterject, generateResponsePool };
