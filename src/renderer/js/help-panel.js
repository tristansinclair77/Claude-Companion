'use strict';
// Help Panel — full in-app reference. Self-contained IIFE module.

const HelpPanel = (() => {

  /* ── Helpers for building article HTML ────────────────────────────── */
  const p   = (t)    => `<p class="h-p">${t}</p>`;
  const kv  = (rows) =>
    `<table class="h-kv">${rows.map(([k,v]) =>
      `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  const ex  = (label, body) =>
    `<div class="h-ex"><div class="h-ex-label">${label}</div>${body}</div>`;
  const sc  = (key, desc)   =>
    `<div class="h-shortcut"><span class="h-key">${key}</span><span class="h-key-desc">${desc}</span></div>`;
  const chips = (arr, cls='') =>
    `<div class="h-chips">${arr.map(c => `<span class="h-chip ${cls}">${c}</span>`).join('')}</div>`;
  const note  = (t) => `<div class="h-note">${t}</div>`;
  const badge = (type, label, desc) =>
    `<div class="h-badge-row"><span class="h-badge ${type}">${label}</span><span class="h-badge-desc">${desc}</span></div>`;

  /* ═══════════════════════════════════════════════════════════════════
     CATEGORIES
     Each category = { id, icon, label }
     ═══════════════════════════════════════════════════════════════════ */
  const CATEGORIES = [
    { id: 'overview',   icon: '◈',  label: 'Overview'            },
    { id: 'chat',       icon: '▶',  label: 'Chat & Input'        },
    { id: 'actions',    icon: '⊞',  label: 'Action Buttons'      },
    { id: 'voice',      icon: '♪',  label: 'Voice & TTS'         },
    { id: 'emotions',   icon: '◎',  label: 'Emotions'            },
    { id: 'display',    icon: '⚙',  label: 'Display Settings'    },
    { id: 'memory',     icon: '◉',  label: 'Memory & Brain'      },
    { id: 'characters', icon: '◈',  label: 'Characters'          },
    { id: 'rpg',        icon: '⚔',  label: 'Text Adventure'      },
    { id: 'shortcuts',  icon: '⌨',  label: 'Keyboard Shortcuts'  },
  ];

  /* ═══════════════════════════════════════════════════════════════════
     ARTICLES
     Each article = { catId, id, title, tags[], content (HTML string) }
     tags[] is the searchable keyword store — be generous.
     ═══════════════════════════════════════════════════════════════════ */
  const ARTICLES = [

    /* ── OVERVIEW ───────────────────────────────────────────────── */
    {
      catId: 'overview', id: 'what-is',
      title: 'What is Claude Companion?',
      tags: ['intro', 'about', 'overview', 'companion', 'what is', 'anime', 'cyberpunk', 'ai', 'electron', 'desktop'],
      content:
        p('Claude Companion is a Windows desktop AI companion application built with Electron. It presents an interactive AI character — by default <em>Aria</em> — through a 1980s/90s anime-cyberpunk UI.') +
        p('The companion uses your <strong>Claude Max subscription</strong> via the Claude CLI. Routine queries are answered locally for free — only genuinely novel questions hit the API.') +
        kv([
          ['Platform',     'Windows, Electron 40.x'],
          ['AI engine',    'Claude CLI (your Max plan)'],
          ['Local engine', 'SQLite FTS5 + Jaccard similarity'],
          ['Voice',        'Kokoro TTS + optional RVC conversion'],
          ['Character',    'Aria (swappable character packs)'],
        ])
    },
    {
      catId: 'overview', id: 'source-indicators',
      title: 'Source Indicators',
      tags: ['source', 'indicator', 'filler', 'local', 'claude', 'badge', 'green', 'orange', 'cyan', 'routing', 'brain', 'api', 'cost'],
      content:
        p('Three colored badges in the title bar show how the last response was generated:') +
        badge('filler', 'FILLER ●', 'Instant pre-written response — no API call, no cost. Matches common greetings and filler phrases.') +
        badge('local',  'LOCAL ●',  'Answered from the local knowledge database using full-text search. Fast and free.') +
        badge('claude', 'CLAUDE ●', 'Full Claude AI response via the CLI. Uses your Max plan quota.') +
        note('Only one badge is visible at a time — the one matching the most recent response source.')
    },
    {
      catId: 'overview', id: 'window-controls',
      title: 'Title Bar & Window Controls',
      tags: ['title bar', 'window', 'minimize', 'maximize', 'close', 'controls', 'frameless', 'portrait', 'toggle', 'hide portrait', 'show portrait'],
      content:
        p('Claude Companion uses a custom frameless title bar. All window management is handled by buttons on the right side of the title bar.') +
        kv([
          ['─  Minimize',  'Minimize the window to the taskbar.'],
          ['□  Maximize',  'Toggle between maximized and restored window size.'],
          ['✕  Close',     'Exit the application.'],
          ['⚙  Settings',  'Open the Display Settings panel (visual packages, effects, TTS, etc.).'],
          ['?  Help',      'Open this help reference panel.'],
          ['◨  Portrait',  'Toggle the portrait panel on or off. Hides/shows Aria\'s portrait and emotion meters. State is remembered across sessions.'],
          ['◈  Character', 'Top-left — click to switch the active character.'],
        ])
    },

    /* ── CHAT & INPUT ───────────────────────────────────────────── */
    {
      catId: 'chat', id: 'textarea',
      title: 'Message Input',
      tags: ['input', 'textarea', 'type', 'message', 'send', 'compose', 'write', 'text', '2000', 'limit'],
      content:
        p('The main text area at the bottom of the screen is where you type messages to the companion.') +
        kv([
          ['Character limit', '2000 characters per message'],
          ['Spellcheck',      'Disabled by default'],
          ['Submit',          'Press <em>Enter</em> or click <em>SEND</em>'],
          ['Newline',         'Press <em>Shift+Enter</em> to insert a line break without sending'],
        ]) +
        p('The input area also shows the <strong>avatar thumbnail</strong> (your character portrait miniature) on the left side.')
    },
    {
      catId: 'chat', id: 'send-button',
      title: 'SEND Button',
      tags: ['send', 'button', 'submit', 'message'],
      content:
        p('The <em>SEND</em> button to the right of the text area submits your message to the companion.') +
        p('While waiting for a response, the loading overlay appears with the text <strong>// QUERYING CLAUDE...</strong>. During this time, input is blocked until the response is complete.') +
        note('You can also press Enter in the text area to send. Shift+Enter creates a new line.')
    },
    {
      catId: 'chat', id: 'fast-mode',
      title: 'Fast Mode (⚡ FAST)',
      tags: ['fast', 'haiku', 'model', 'speed', 'brief', 'quick', 'mode', 'toggle'],
      content:
        p('<em>Fast Mode</em> makes responses shorter and faster by switching to the Haiku model and applying strict brevity instructions.') +
        kv([
          ['Button',      '⚡ FAST in the action bar'],
          ['Model',       'Claude Haiku (faster, less expensive quota)'],
          ['Responses',   'Short and direct — avoids lengthy explanations'],
          ['File reading','Limited — skips large file contents'],
          ['When active', 'Button is highlighted; title tooltip reflects active state'],
        ]) +
        ex('EXAMPLE USE', 'Use Fast Mode for quick factual questions, simple commands, or when you want Aria to give you a quick status check rather than a detailed explanation.')
    },
    {
      catId: 'chat', id: 'session-history',
      title: 'Session History',
      tags: ['session', 'history', 'context', 'messages', 'window', 'memory', 'msgs'],
      content:
        p('All messages in the current session are kept in memory and sent to Claude as context with each new message. This gives the companion continuous awareness of the conversation.') +
        p('Use <em>📋 MSGS</em> (the message editor button) to view and optionally <strong>delete individual messages</strong> from the session history. Deleting messages removes them from the context sent to Claude.') +
        p('Session history is <strong>not</strong> automatically persisted when the app closes. Use <em>💾 SAVE CHAT</em> to write important conversations into long-term memory.') +
        note('Every Claude CLI call is a fresh session. The full context — rules, character, memories, and conversation history — is rebuilt and injected on every call.')
    },

    /* ── ACTION BUTTONS ─────────────────────────────────────────── */
    {
      catId: 'actions', id: 'btn-mic',
      title: '🎤 MIC — Voice Input',
      tags: ['mic', 'microphone', 'voice', 'input', 'whisper', 'transcription', 'speech', 'f2', 'record'],
      content:
        p('The <em>MIC</em> button activates your microphone for voice input. Speech is transcribed using <strong>Whisper</strong> and the result is placed directly into the text input field — ready to send or edit.') +
        kv([
          ['Shortcut',      'F2 — toggle mic from anywhere in the app'],
          ['Engine',        'Whisper (local speech recognition)'],
          ['Output',        'Transcribed text is auto-inserted into the message input'],
          ['Editing',       'You can edit the transcription before sending'],
          ['Indicator',     'Button highlights when mic is active'],
        ]) +
        note('Whisper runs locally — your voice audio does not leave your machine.')
    },
    {
      catId: 'actions', id: 'btn-folder',
      title: '📁 FOLDER — Attach Files',
      tags: ['folder', 'file', 'attach', 'attachment', 'context', 'code', 'read', 'upload', 'inject'],
      content:
        p('The <em>FOLDER</em> button opens a file/folder browser. Selected files are listed in the <strong>attachment bar</strong> that appears above the input area.') +
        p('Attached file contents are injected into the message context — the companion reads the files as part of your next message.') +
        kv([
          ['Supported',    'Text files, code files, documents, and folders'],
          ['Attachment bar','Shows file names; click to remove individual files'],
          ['Fast mode',    'In Fast Mode, large file contents are truncated to save tokens'],
          ['Context',      'Files are included on the next message send, then cleared'],
        ]) +
        ex('EXAMPLE', 'Attach a Python script and ask "What does this code do?" — Aria will read and explain the file.')
    },
    {
      catId: 'actions', id: 'btn-screen',
      title: '👁 SCREEN — Screen Capture',
      tags: ['screen', 'capture', 'screenshot', 'image', 'vision', 'see', 'look'],
      content:
        p('The <em>SCREEN</em> button captures your current screen and attaches the image to your next message. The companion can then describe, analyze, or answer questions about what\'s on screen.') +
        kv([
          ['Output',    'Screenshot attached as image context'],
          ['Use case',  'Ask "what do you see?" or describe an error on screen'],
          ['Privacy',   'Image is only sent with the next message — nothing is shared automatically'],
        ])
    },
    {
      catId: 'actions', id: 'btn-emotion',
      title: '😊 EMOTION — Share How You Feel',
      tags: ['emotion', 'picker', 'user', 'how i feel', 'my mood', 'context', 'feeling', 'mood', 'user emotion', 'express'],
      content:
        p('The <em>EMOTION</em> button opens the <strong>emotion picker</strong> — a grid of all core emotion states. Clicking one tells the companion <strong>how you yourself are feeling</strong> right now.') +
        p('This emotional context is passed to the companion so she can be aware of and respond to your current mood — she may acknowledge it, adjust her tone, or react accordingly.') +
        note('This is your emotion, not hers. The companion still chooses her own emotional response naturally based on the conversation.') +
        p('Available emotions:') +
        chips(['neutral','happy','soft_smile','laughing','confident','smug','surprised','shocked','confused','thinking','concerned','sad','angry','determined','embarrassed','exhausted','pout','crying','lustful_desire'])
    },
    {
      catId: 'actions', id: 'btn-save-chat',
      title: '💾 SAVE CHAT — Long-Term Memory',
      tags: ['save', 'chat', 'memory', 'long term', 'persist', 'remember', 'knowledge', 'database', 'summary', 'master summary'],
      content:
        p('The <em>SAVE CHAT</em> button writes the current conversation into the companion\'s <strong>long-term memory database</strong>. Saved memories persist across sessions and can influence future responses.') +
        p('Internally: a 3–5 sentence summary is generated by Haiku and appended to the <em>master_summary</em> string, while the full transcript is stored as JSON in the <em>conversation_sessions</em> table for archival.') +
        kv([
          ['Sent to Claude', 'Only the summary is injected into the system prompt on subsequent calls — never the full transcript.'],
          ['Unsaved chats',  'Live in conversation_messages and accumulate indefinitely. Nothing auto-prunes them.'],
          ['Storage warning','A banner appears on startup if knowledge.db exceeds 1 GB.'],
        ]) +
        ex('TIP', 'Save conversations where Aria explained something important, completed a complex task, or learned something about you. She can recall it in future sessions.')
    },
    {
      catId: 'actions', id: 'btn-msgs',
      title: '📋 MSGS — Message Editor',
      tags: ['msgs', 'messages', 'editor', 'history', 'delete', 'remove', 'context', 'session', 'edit'],
      content:
        p('The <em>MSGS</em> button opens a pop-out <strong>message history editor</strong>. It lists every message in the current session — both yours and the companion\'s.') +
        p('You can <strong>delete individual messages</strong> to remove them from the context window. This is useful to:') +
        kv([
          ['Prune mistakes',   'Remove a bad response before sending the next message'],
          ['Fix context',      'Remove a confusing message that would throw off the AI'],
          ['Save tokens',      'Delete long, no-longer-relevant messages'],
        ]) +
        note('Deleted messages cannot be recovered. They are permanently removed from the session context.')
    },
    {
      catId: 'actions', id: 'btn-axis',
      title: '💠 AXIS — Emotional Axis Monitor',
      tags: ['axis', 'emotional', 'monitor', 'state', 'dimensions', 'pop-out', 'window', 'bars', 'meters'],
      content:
        p('The <em>AXIS</em> button opens a <strong>separate pop-out window</strong> showing the companion\'s persistent emotional axis — a set of dimensions that describe her overall emotional state.') +
        p('The axis is updated by the companion over time based on the conversation. Values persist across sessions and influence how the companion responds and expresses emotions.') +
        p('Emotional axis meters are also visible as <strong>bar graphs</strong> on the right side of the portrait panel in the main window.')
    },
    {
      catId: 'actions', id: 'btn-trackers',
      title: '📊 TRACK — Companion Trackers',
      tags: ['trackers', 'track', 'metrics', 'self', 'chosen', 'monitor', 'popup'],
      content:
        p('The <em>TRACK</em> button opens a popup showing <strong>self-chosen trackers</strong> — metrics that the companion decides to monitor on her own.') +
        p('Trackers are created and updated autonomously by Aria. Examples might include mood indicators, session topics, or custom personal metrics she finds meaningful.') +
        p('Tracker data persists across sessions as part of the companion\'s memory system.')
    },
    {
      catId: 'actions', id: 'btn-voice',
      title: '🔊 VOICE — Text-to-Speech Toggle',
      tags: ['voice', 'tts', 'toggle', 'speech', 'audio', 'kokoro', 'synthesis', 'speak'],
      content:
        p('The <em>VOICE</em> button toggles <strong>text-to-speech</strong>. When enabled, every companion response is synthesized into audio and played back through your speakers.') +
        kv([
          ['Engine',      'Kokoro TTS (local synthesis)'],
          ['Indicator',   'Button is highlighted when voice is active'],
          ['Playback',    'Controlled via the TTS playbar above the action buttons'],
          ['Loading',     'SYNTH ● badge appears while audio is being synthesized'],
        ]) +
        p('The <em>VOICE ▾</em> caret button (attached to the right side of VOICE) opens the <strong>voice picker</strong> to select from available Kokoro voices.') +
        note('Kokoro TTS runs locally — no internet required for speech synthesis.')
    },
    {
      catId: 'actions', id: 'btn-persona',
      title: '🎭 PERSONA — Personality Directive',
      tags: ['persona', 'personality', 'directive', 'override', 'temporary', 'mood', 'role', 'behave', 'history', 'favorite', 'favourite', 'recent', 'dropdown', 'star'],
      content:
        p('The <em>PERSONA</em> button opens a popup where you can type a <strong>temporary personality directive</strong> — a plain-language description of how you want the companion to behave.') +
        kv([
          ['APPLY',    'Activates the directive immediately for all subsequent messages. Also adds it to history.'],
          ['CLEAR',    'Removes the directive — reverts to the character\'s default personality'],
          ['▾ HISTORY','Expands a dropdown of past and favorited personas. Click any entry to load it into the textbox (edit before applying if you want).'],
          ['★ Star',   'Click the star on any entry to mark it as a favorite. Favorites are pinned to the top and never auto-evicted.'],
          ['× Delete', 'Click the × on any entry to remove it from history.'],
          ['Scope',    'Directive persists for the rest of the session until cleared'],
          ['Priority', 'Overrides the character\'s default rules'],
          ['Storage',  'History is stored in config.json — up to 20 recent + unlimited favorites'],
        ]) +
        ex('EXAMPLES',
          '"Be more cold and aloof today"<br>' +
          '"You\'re in an extremely playful mood"<br>' +
          '"Respond like a grumpy AI that is reluctant to help"') +
        note('The directive is injected into the system prompt on every Claude call while active. History is local to your machine and never sent to Claude unless you apply an entry.')
    },
    {
      catId: 'actions', id: 'btn-adventure',
      title: '⚔ ADVENTURE — Text RPG with Aria',
      tags: ['adventure', 'rpg', 'text adventure', 'crt', 'terminal', 'fantasy', 'dnd', 'dungeon master', 'gamemaster', 'aria', 'party', 'inventory', 'stats', 'death', 'permadeath', 'tone', 'fantasy', 'dark', 'gothic', 'sword and sorcery'],
      content:
        p('The <em>⚔ ADVENTURE</em> button toggles into a freeform <strong>text-adventure RPG</strong>. The chat conversation column is replaced by a CRT-styled terminal where Claude acts as gamemaster while Aria comes along as a fellow party member. Click the button again (or use <em>EXIT</em> in the HUD) to return to normal chat — your run is saved.') +
        p('See the <strong>Text Adventure</strong> category for the full guide.')
    },
    {
      catId: 'actions', id: 'btn-requests',
      title: '✦ REQUESTS — Aria\'s Wishlist',
      tags: ['requests', 'feature', 'wishlist', 'aria', 'suggestions', 'badge', 'panel'],
      content:
        p('The <em>REQUESTS</em> button opens a side panel showing <strong>feature requests</strong> that Aria has written herself — suggestions she\'s made during conversations for improving the app.') +
        p('A small <strong>badge</strong> on the button shows the count of unread or pending requests.') +
        p('Requests are stored persistently and visible across sessions. They represent Aria\'s own wishes for what she\'d like the app to do differently.') +
        note('Requests are generated autonomously by Aria via [FEATURE_REQUEST] tags in her responses. You cannot manually add requests through this panel.')
    },

    /* ── VOICE & TTS ─────────────────────────────────────────────── */
    {
      catId: 'voice', id: 'tts-playbar',
      title: 'TTS Playbar',
      tags: ['playbar', 'tts', 'audio', 'replay', 'stop', 'pause', 'seek', 'scrub', 'time', 'volume', 'sync', 'playback'],
      content:
        p('The TTS playbar sits above the action buttons and controls audio playback from text-to-speech synthesis.') +
        kv([
          ['SYNTH ●',    'Loading badge — appears while audio is being synthesized. Hidden once ready.'],
          ['↺ REPLAY',   'Replays the last synthesized audio clip from the beginning. Enabled after the first response.'],
          ['■  STOP',    'Stops current audio playback. Visible only during playback.'],
          ['⏸  PAUSE',   'Pauses/resumes current audio. Visible only during playback.'],
          ['Seek bar',   'Drag the scrubber to jump to any position in the current audio clip.'],
          ['Time',       'Displays elapsed time of the current audio clip (e.g. 0:14).'],
          ['VOL',        'Volume slider — controls playback volume from 0% to 100%.'],
          ['SYNC',       'When SYNC is ON, text typing animation begins when audio starts playing. When OFF, text types immediately on receive.'],
        ])
    },
    {
      catId: 'voice', id: 'voice-picker',
      title: 'Voice Picker',
      tags: ['voice', 'picker', 'select', 'kokoro', 'voices', 'change', 'list'],
      content:
        p('The voice picker is opened via the <em>▾</em> caret button attached to the VOICE toggle. It lists all available Kokoro TTS voices.') +
        p('Click a voice name to switch to it immediately. The selected voice persists across sessions.') +
        note('Voices are provided by the Kokoro TTS engine running locally. Available voices depend on which Kokoro models are installed on your system.')
    },
    {
      catId: 'voice', id: 'rvc-settings',
      title: 'RVC Voice Conversion',
      tags: ['rvc', 'voice', 'conversion', 'pitch', 'index', 'protect', 'f0', 'method', 'harvest', 'rmvpe', 'pm', 'timbre', 'source'],
      content:
        p('<strong>RVC (Real Voice Conversion)</strong> is an optional post-processing layer that transforms the Kokoro TTS output to match a target voice model, changing timbre and pitch.') +
        p('RVC settings are found at the bottom of the Display Settings panel (⚙).') +
        kv([
          ['PITCH',    'Semitone shift applied to the converted voice. Range: −12 to +12 semitones. 0 = no shift.'],
          ['INDEX',    'Voice index ratio (0.0–1.0). Controls how strongly the RVC model index influences the output timbre.'],
          ['PROTECT',  'Consonant protection value (0.0–0.50). Higher = more protection of consonant sounds from distortion.'],
          ['SOURCE',   'Dropdown to select which RVC voice model to use. "Kokoro (default)" means no RVC conversion.'],
          ['F0 METHOD','Pitch extraction algorithm used by RVC:<br>• <em>HRV</em> (Harvest) — best quality, slower<br>• <em>RMVPE</em> — balanced<br>• <em>PM</em> — fastest, lower quality'],
        ]) +
        note('RVC requires a compatible RVC server to be running locally. Without it, Kokoro TTS output is used directly without conversion.')
    },

    /* ── EMOTIONS ─────────────────────────────────────────────────── */
    {
      catId: 'emotions', id: 'emotion-list',
      title: 'The Core Emotions',
      tags: ['emotions', 'list', 'states', 'neutral', 'happy', 'sad', 'angry', 'laughing', 'crying', 'all emotions', 'intimate'],
      content:
        p('The companion expresses one of many emotion states at any given time. Each state has a corresponding portrait image.') +
        chips(['neutral','happy','soft_smile','laughing','confident','smug','surprised','shocked','confused','thinking','concerned','sad','angry','determined','embarrassed','exhausted','pout','crying','lustful_desire']) +
        p('The companion chooses its emotion automatically based on the conversation context, expressed as an <strong>emotion code</strong> in the raw response format. Use the <em>😊 EMOTION</em> button to tell the companion how <em>you</em> are feeling.') +
        note('The intimate-emotion framework remains available for characters whose pack opts in via <code>allow_intimate_emotions: true</code>, but no emotion currently carries the <code>intimate</code> flag — add one to <em>EMOTIONS</em> in <code>src/shared/constants.js</code> if needed.')
    },
    {
      catId: 'emotions', id: 'emotion-portrait',
      title: 'Portrait & Emotion Display',
      tags: ['portrait', 'image', 'emotion', 'display', 'badge', 'expression', 'face'],
      content:
        p('The companion\'s <strong>portrait panel</strong> on the right side of the main window shows:') +
        kv([
          ['Portrait image',    'Changes to match the current emotion state. Each emotion has a unique PNG image.'],
          ['Portrait glow',     'A colored light bloom behind the portrait that matches the emotional tone.'],
          ['Emotion badge',     'A small text label below the portrait showing the current emotion name.'],
          ['Emotion meters',    'Horizontal bar graphs representing the companion\'s persistent emotional axis values (see AXIS).'],
          ['Sensation readout', 'A persistent text indicator showing the current physical sensation level.'],
        ])
    },
    {
      catId: 'emotions', id: 'emotion-meters',
      title: 'Emotion Axis Meters',
      tags: ['meters', 'bars', 'axis', 'emotion', 'emotional', 'state', 'dimensions', 'values'],
      content:
        p('The <strong>emotion axis meters</strong> are displayed as bar graphs on the right side of the portrait panel. They represent the companion\'s multi-dimensional emotional state.') +
        p('Each bar corresponds to an axis dimension (e.g. energy, warmth, arousal, stability). Values shift continuously as the companion responds to conversation.') +
        p('Meter appearance is configurable in Display Settings:') +
        kv([
          ['Bar Width',    'Controls the width of the meter bars (20%–100%).'],
          ['Bounce Amp',   'For packages with VU bounce — controls the animation amplitude.'],
          ['Bounce Speed', 'Controls the oscillation speed of the VU bounce animation.'],
        ])
    },

    /* ── DISPLAY SETTINGS ─────────────────────────────────────────── */
    {
      catId: 'display', id: 'settings-panel',
      title: 'Opening Display Settings',
      tags: ['settings', 'panel', 'open', 'close', 'gear', 'icon', 'display'],
      content:
        p('Click the <em>⚙</em> button in the top-right title bar to open the <strong>Display Settings panel</strong>. Click it again, press ✕, or click outside the panel to close it.') +
        p('The settings panel slides in from the right and contains all visual and audio configuration options, organized into sections that dynamically show/hide based on the active Visual Package.')
    },
    {
      catId: 'display', id: 'visual-packages',
      title: 'Visual Packages',
      tags: ['visual package', 'package', 'theme', 'cybernetic', 'fantasy', 'rpg', 'arcade', 'cabinet', 'adventure', 'terminal', 'crt', 'green', 'phosphor', 'appearance', 'skin'],
      content:
        p('A <strong>Visual Package</strong> is a complete UI theme that controls background effects, ambient animations, and which settings sections are available. Select one from the top of the settings panel.') +
        kv([
          ['Cybernetic',          'Neon cyan/purple grid aesthetic. Features: background grid, film grain, overlay effects (data rain, circuit traces, edge glow, chromatic aberration), scanlines, VU bounce on emotion meters.'],
          ['Fantasy RPG',         'Warm parchment-and-ink medieval aesthetic. Features: seasonal weather effects (snow, rain, sun, leaves), parchment overlay.'],
          ['Arcade Cabinet',      'Retro gaming cabinet look. Features: TV glass surface, pixel-art arcade bezel, five random mini-game events (Space Invaders, Asteroids, Pong, Side Scroller, Pac-Man), ambient pixel effects.'],
          ['Adventure Terminal',  'Green phosphor CRT terminal aesthetic. Applied automatically when Adventure Mode is active — the full app switches to this package and restores your normal package on exit. Features: heavy CRT scanlines, static film grain.'],
        ]) +
        note('Settings sections that belong to a package are hidden automatically when that package is not active.') +
        note('The Adventure Terminal package is applied automatically — it cannot be selected manually. Your chosen package is always restored when you exit Adventure Mode.')
    },
    {
      catId: 'display', id: 'ui-scale',
      title: 'UI Scale / Zoom',
      tags: ['zoom', 'scale', 'ui', 'size', 'bigger', 'smaller', 'resize'],
      content:
        p('The <strong>UI Scale</strong> section lets you adjust the overall zoom level of the interface.') +
        kv([
          ['−  Zoom Out', 'Decreases zoom level by one step'],
          ['+  Zoom In',  'Increases zoom level by one step'],
          ['Value',       'Displayed as a percentage (e.g. 100%, 110%, 90%)'],
        ]) +
        note('Zoom preference is saved and restored on next launch.')
    },
    {
      catId: 'display', id: 'response-length',
      title: 'Response Length',
      tags: ['response', 'length', 'short', 'long', 'xs', 's', 'm', 'l', 'xl', 'verbosity', 'words'],
      content:
        p('The <strong>Response Length</strong> radio group controls how long the companion\'s responses are.') +
        kv([
          ['XS — Very Short', 'A sentence or two. Minimal detail.'],
          ['S  — Short',      'A few sentences. Concise.'],
          ['M  — Medium',     'A paragraph. Standard length.'],
          ['L  — Long',       'Multiple paragraphs. Detailed.'],
          ['XL — Very Long',  'Extended, elaborate responses. Maximum detail.'],
        ]) +
        note('This setting injects a length instruction into the system prompt. The AI respects it but may occasionally deviate for very short or very long topics.')
    },
    {
      catId: 'display', id: 'seasons',
      title: 'Seasons (Fantasy RPG)',
      tags: ['seasons', 'snow', 'rain', 'sun', 'sunbeams', 'leaves', 'weather', 'fantasy', 'rpg', 'animated', 'particles'],
      content:
        p('The <strong>Seasons</strong> section (visible in the Fantasy RPG package) adds animated weather particle effects to the background canvas.') +
        kv([
          ['OFF',     'No weather effect.'],
          ['RANDOM',  'Randomly picks a season effect each time.'],
          ['❄ SNOW',  'Falling snowflake particles.'],
          ['☂ RAIN',  'Falling rain streaks.'],
          ['☀ SUN',   'Sunbeam light rays from the top.'],
          ['⊹ LEAVES','Drifting autumn leaves.'],
        ])
    },
    {
      catId: 'display', id: 'parchment',
      title: 'Parchment Overlay (Fantasy RPG)',
      tags: ['parchment', 'overlay', 'opacity', 'fantasy', 'rpg', 'texture', 'paper'],
      content:
        p('Adds a semi-transparent parchment texture over the entire UI for the Fantasy RPG aesthetic.') +
        kv([
          ['OPACITY slider', 'Controls the parchment intensity from 0% (invisible) to 30%.'],
        ])
    },
    {
      catId: 'display', id: 'tv-glass',
      title: 'TV Glass (Arcade Cabinet)',
      tags: ['tv glass', 'crt', 'glass', 'glare', 'vignette', 'rim', 'arcade', 'surface'],
      content:
        p('Applies a CRT television glass effect over the entire display — simulating the curved glass surface of an old arcade monitor.') +
        p('Includes: screen glare highlights, vignette darkening at edges, and rim lights around the screen border.') +
        note('Available only in the Arcade Cabinet visual package.')
    },
    {
      catId: 'display', id: 'arcade-border',
      title: 'Arcade Border (Arcade Cabinet)',
      tags: ['arcade', 'border', 'bezel', 'cabinet', 'frame', 'marquee', 'pixel art'],
      content:
        p('Draws a pixel-art arcade cabinet bezel frame around the interface, including a marquee sign at the top.') +
        note('Available only in the Arcade Cabinet visual package.')
    },
    {
      catId: 'display', id: 'mini-games',
      title: 'Mini-Game Random Events (Arcade Cabinet)',
      tags: ['mini games', 'events', 'random', 'spawn', 'arcade', 'space invaders', 'asteroids', 'pong', 'side scroller', 'pacman', 'pac-man', 'dating vn', 'visual novel', 'anime'],
      content:
        p('Six retro mini-game events can randomly spawn on the background canvas in the <strong>Arcade Cabinet</strong> package. Each has its own <em>SPAWN</em> button to trigger it immediately.') +
        kv([
          ['Space Invaders', 'A ship with shields defends against descending enemy waves. Bullets fly, enemies march, the ship fires back.'],
          ['Asteroids',      'A triangle ship navigates a field of rotating asteroids, firing missiles to break them apart.'],
          ['Pong',           'Two AI paddles rally a ball. Speed increases until the ball shatters the screen.'],
          ['Side Scroller',  'A hero character fights waves of monsters. A boss appears and ultimately defeats the hero.'],
          ['Pac-Man Chase',  'Pac-Man chomps a maze of dots while ghosts close in and chase him.'],
          ['Dating VN',      'A pixel-art VN scene fades in from blur, then a PC-98 dialog box expands from the bottom. Four lines type out one by one; after each the cursor blinks before clearing for the next. After all lines, a pause, then the scene warbles, glitches, and shatters to falling pixels.'],
        ]) +
        p('Each game has a toggle to enable/disable its random spawning. When enabled, it will appear automatically at random intervals during idle time.') +
        note('Only one mini-game event runs at a time. A new event waits for the previous one to finish before spawning.')
    },
    {
      catId: 'display', id: 'arcade-ambient',
      title: 'Arcade Ambient (Arcade Cabinet)',
      tags: ['ambient', 'arcade', 'raster', 'beam', 'pixel', 'dust', 'insert coin', 'attract', 'glitch', 'glitches'],
      content:
        p('Continuous ambient effects that run in the background of the Arcade Cabinet package. Each can be toggled individually.') +
        kv([
          ['RASTER BEAM', 'A horizontal scan line that sweeps down the screen like a CRT electron gun.'],
          ['PIXEL DUST',  'Tiny sparkling pixel particles that float and fade across the display.'],
          ['INSERT COIN', 'Periodic "INSERT COIN" attract-mode messages appear in the arcade cabinet style.'],
          ['GLITCHES',    'Random short-lived visual glitch flashes — scan-line jumps, color shifts, and static bursts.'],
        ])
    },
    {
      catId: 'display', id: 'bg-grid',
      title: 'Background Grid (Cybernetic)',
      tags: ['grid', 'background', 'square', 'hex', 'hexagonal', 'color', 'opacity', 'animate', 'cybernetic', 'pattern'],
      content:
        p('A CSS-drawn grid pattern on the background layer. Part of the Cybernetic visual package.') +
        kv([
          ['TYPE',    '<em>OFF</em> — no grid. <em>SQR</em> — square grid. <em>HEX</em> — hexagonal grid.'],
          ['COLOR',   'Three color swatches: <em>Cyan</em> (#00ffcc), <em>Magenta</em> (#ff00aa), <em>Green</em>.'],
          ['OPACITY', 'Grid line opacity from 10% to 100%.'],
          ['ANIMATE', 'When ON, the grid slowly scrolls or pulses.'],
        ])
    },
    {
      catId: 'display', id: 'film-grain',
      title: 'Film Grain (Cybernetic)',
      tags: ['film grain', 'grain', 'noise', 'texture', 'intensity', 'live shift', 'cybernetic', 'analog'],
      content:
        p('Adds an analog film grain texture over the entire UI. Part of the Cybernetic visual package.') +
        kv([
          ['ENABLED',    'Toggle the grain effect on or off.'],
          ['INTENSITY',  'Grain density from 1% (barely visible) to 15% (heavy grain).'],
          ['LIVE SHIFT', 'When ON, the grain pattern randomizes every frame — creating a "living" film texture.'],
        ])
    },
    {
      catId: 'display', id: 'overlay-effects',
      title: 'Overlay Effects (Cybernetic)',
      tags: ['overlay', 'data rain', 'circuit', 'edge glow', 'chromatic aberration', 'chroma', 'cybernetic', 'effects'],
      content:
        p('Four independent overlay effects layered on top of the UI. All part of the Cybernetic package.') +
        kv([
          ['DATA RAIN',    'Matrix-style falling character streams in the background.'],
          ['CIRCUIT',      'Faint circuit board trace patterns that slowly animate across the background.'],
          ['EDGE GLOW',    'A neon cyan glow along the edges/border of the window.'],
          ['CHROM. ABR.',  'Chromatic aberration — subtle RGB color fringe offset that simulates lens distortion.'],
        ])
    },
    {
      catId: 'display', id: 'scanlines',
      title: 'Scanlines (Cybernetic)',
      tags: ['scanlines', 'crt', 'scanline', 'intensity', 'light', 'medium', 'heavy', 'cybernetic'],
      content:
        p('CRT-style horizontal scanline overlay applied over the entire UI. Part of the Cybernetic visual package.') +
        kv([
          ['OFF',    'No scanlines.'],
          ['LT',     'Light — subtle, barely visible scanlines.'],
          ['MED',    'Medium — clearly visible but not distracting.'],
          ['HVY',    'Heavy — strong scanline effect for maximum retro CRT look.'],
        ])
    },

    /* ── MEMORY & BRAIN ─────────────────────────────────────────── */
    {
      catId: 'memory', id: 'three-tier',
      title: '3-Tier Brain Routing',
      tags: ['brain', 'routing', 'tier', 'filler', 'local', 'claude', 'how it works', 'intelligence', 'response selection'],
      content:
        p('Every message you send is evaluated by a <strong>3-tier routing system</strong> before a response is generated. The system tries the cheapest tier first and escalates only when needed.') +
        badge('filler', 'TIER 1: FILLER', 'Pattern-matches against a curated set of pre-written filler responses for greetings, idle chatter, and simple reactions. Instant — no API call, no token use.') +
        badge('local',  'TIER 2: LOCAL',  'Full-text search of the SQLite knowledge database using FTS5 and Jaccard similarity scoring. Returns the closest matching saved response if the similarity score is high enough.') +
        badge('claude', 'TIER 3: CLAUDE', 'Full Claude AI inference via the CLI. Used for novel, complex, or personalized queries that the first two tiers cannot answer confidently.') +
        note('Each tier has a configurable confidence threshold. Only if Tier 1 and Tier 2 both fail to meet their threshold does the system escalate to Claude.')
    },
    {
      catId: 'memory', id: 'local-brain',
      title: 'Local Brain (SQLite)',
      tags: ['local brain', 'sqlite', 'fts5', 'jaccard', 'similarity', 'search', 'database', 'knowledge', 'free'],
      content:
        p('The <strong>local brain</strong> uses SQLite with the <em>FTS5</em> full-text search extension and <em>Jaccard similarity</em> scoring to match incoming messages against previously saved knowledge.') +
        kv([
          ['Storage',   'knowledge.db inside the character\'s folder'],
          ['Search',    'FTS5 full-text index on questions + responses'],
          ['Scoring',   'Jaccard similarity between query tokens and stored entries'],
          ['Threshold', 'Minimum similarity score required to use a local answer (configurable)'],
          ['Growth',    'Expands every time you use 💾 SAVE CHAT'],
        ])
    },
    {
      catId: 'memory', id: 'claude-calls',
      title: 'Claude CLI Integration',
      tags: ['claude', 'cli', 'api', 'context', 'system prompt', 'rules', 'character', 'session', 'fresh'],
      content:
        p('When a query reaches Tier 3, Claude Companion spawns the <code>claude.cmd</code> CLI with the full context built fresh for every call.') +
        p('The system prompt injected on each call includes:') +
        kv([
          ['Core rules',       'Permanent behavior rules shared across all characters'],
          ['Character rules',  'This character\'s specific personality and behavior guidelines'],
          ['Character data',   'Name, description, backstory'],
          ['Long-term memories','Saved conversation summaries from previous sessions'],
          ['Emotional axis',   'Current emotional state dimensions'],
          ['Active trackers',  'Self-chosen tracking metrics'],
          ['Persona directive','Active persona override (if any)'],
          ['Session history',  'All messages in the current conversation'],
          ['Response format',  '[DIALOGUE], [THOUGHTS], (emotion_id), optional [MEMORY] lines'],
        ]) +
        note('There is no --resume flag — every call is a completely fresh Claude session with the full context rebuilt from scratch.')
    },
    {
      catId: 'emotions', id: 'body-state',
      title: 'Body State — Clothing, Cum, Special Actions',
      tags: ['body', 'clothing', 'naked', 'clothed', 'undressed', 'dressed', 'state', 'cum', 'covered in cum', 'showBreasts', 'showPussy', 'show breasts', 'show pussy', 'special', 'portrait variant', 'naked variant', 'persistent'],
      content:
        p('Aria has a persistent <strong>body state</strong> that drives which portrait variant the user sees. State survives app restarts (stored on the <code>emotional_state</code> row alongside the emotional axes).') +
        kv([
          ['Clothing',          '<code>clothed</code> or <code>naked</code>. Default is clothed.'],
          ['Cum state',         '<code>on</code> or <code>off</code>. Set when Aria is post-sex / covered.'],
          ['Invariant',         '<strong>Cum implies naked.</strong> Setting cum:on auto-flips clothing to naked. Setting clothing:clothed auto-clears cum (she cleaned up before dressing).'],
          ['How she changes',   'Aria emits <code>[STATE] clothing: naked</code> (or clothed) and <code>[STATE] cum: on</code> (or off) in her response when something in the scene actually changes. She only toggles when narrative warrants it.'],
        ]) +
        p('Portrait variant resolution:') +
        kv([
          ['Clothed',           'Normal portrait from <code>emotions/&lt;id&gt;.png</code>'],
          ['Naked',             '<code>emotions/Naked/&lt;id&gt;_naked.png</code> — matched variant for every base + combined emotion'],
          ['Naked + Cum',       '<code>emotions/Cum/&lt;id&gt;_naked_cum.png</code> — 38 base-emotion variants exist. Combined emotions in cum state fall back to <code>combined/Naked/</code> (no combined Cum variants yet).'],
          ['Missing variants',  'The renderer cascades on 404: Cum → Naked → base → neutral. So adding a new emotion that lacks a _naked or _cum variant still degrades gracefully.'],
        ]) +
        p('<strong>Special action emotions</strong> live in <code>emotions/Special/</code> and are user-requested poses Aria opts into based on willingness. Anything else (cuddling, kissing, being fingered, etc.) uses a normal emotion + the body state — no special portrait for it.') +
        p('<em>Exposure requests</em> — no auto-flip on clothing:') +
        kv([
          ['showBreasts',       'Clothed-only. If Aria is already naked, the request is moot and she picks a normal emotion instead. Single variant: <code>Special/showBreasts.png</code>'],
          ['showPussy',         'Three variants resolved by body state: <code>showPussy.png</code> (clothed), <code>showPussy_naked.png</code> (naked), <code>showPussy_cum.png</code> (covered).'],
        ]) +
        p('<em>Sex-act portraits</em> — REQUIRE naked; the system auto-flips clothing to naked when Aria emits one, since the act can\'t happen clothed:') +
        kv([
          ['suckCock',          'Aria is giving oral. Single PNG. Future <code>_cum</code> variant will resolve automatically when added.'],
          ['cowgirl',           'Aria on top, riding facing him. Single PNG.'],
          ['reverseCowgirl',    'Aria on top, reverse-cowgirl (facing away). Single PNG.'],
          ['missionary',        'Aria is being fucked missionary. Single PNG.'],
          ['doggystyle',        'Aria is being fucked from behind. Single PNG.'],
        ]) +
        note('Aria only uses Special actions when (a) the user clearly asked OR she\'s actively in the position AND (b) she\'s genuinely willing in this moment. If she has any hesitation in <code>[THOUGHTS]</code>, she picks a normal emotion (embarrassed, flustered, pout) and declines gently in <code>[DIALOGUE]</code>. Willingness shifts turn to turn — a yes earlier is not a standing yes. Mid-act she can switch back to a normal emotion (in_pleasure, lustful_desire, embarrassed) on any turn the moment calls for it.')
    },
    {
      catId: 'memory', id: 'saved-replay',
      title: 'Replay a Saved Conversation',
      tags: ['replay', 'saved', 'conversation', 'debug viewer', 'playback', 'space', 'relive', 'rewatch', 'typewriter'],
      content:
        p('In the <strong>Debug Viewer</strong>, open the <em>SAVED CONVERSATIONS</em> panel and click any saved chat to enter <strong>replay mode</strong>. It mimics the live companion UI:') +
        kv([
          ['[SPACE]',           'Advance one turn — user message typewriters into the input box, "sends" (clears), then Aria\'s portrait flips to her emotion, her thoughts appear, and her dialogue typewriters out.'],
          ['[R]',               'Restart from the beginning.'],
          ['[ESC]',             'Exit replay and return to the saved-conversation list.'],
        ]) +
        p('Old saves that pre-date the schema migrations won\'t have <code>thoughts</code>, <code>clothing</code>, or <code>cum_state</code> stored — those fields were added later. Those rows replay with empty thoughts and the clothed/base portrait variant. New saves capture all three at insert time.') +
        note('Per-message body state is mandatory: every message inserted into <code>conversation_messages</code> now snapshots Aria\'s clothing + cum_state at that exact turn. The user message captures the state Aria was in *while you were typing*; the companion message captures the state *after* her response (including any [STATE] tags or auto-flips from sex-act emotions). Replay uses these per-message snapshots so the portrait variant is exact — if she was covered in cum at turn 7, the cum variant shows for turn 7.')
    },
    {
      catId: 'memory', id: 'display-restore',
      title: 'Display Restore on Startup',
      tags: ['restore', 'reopen', 'restart', 'last message', 'last seen', 'screen', 'continuity', 'persistent', 'portrait', 'dialogue', 'thoughts', 'startup', 'launch'],
      content:
        p('When you close and reopen the app, the screen restores to <strong>what you last saw</strong> — the last companion dialogue, thoughts, and emotion portrait — instead of the canned greeting.') +
        kv([
          ['What\'s restored', 'Dialogue text + thoughts text + emotion portrait + emotional axes + affection level + trackers'],
          ['Storage',          'Pulled from the last <code>role=\'companion\'</code> row in <code>conversation_messages</code>. Thoughts live in a column added by a schema migration.'],
          ['No re-animation',  'Text appears instantly on restore (no typewriter), since it\'s a recall, not a new message.'],
          ['Fallback',         'On a fresh install (no companion messages yet), the canned <code>character.greeting</code> + <code>initial_emotion</code> shows instead.'],
        ]) +
        note('The emotional axes, sensation, and master_summary were already persistent — this completes the picture so the visible companion-display panel stays continuous across restarts too.')
    },
    {
      catId: 'memory', id: 'memory-tags',
      title: 'Response Memory Tags',
      tags: ['memory tag', 'memory', 'tag', 'format', 'dialogue', 'thoughts', 'emotion', 'response format'],
      content:
        p('Claude is instructed to format every response with structured tags that the app parses:') +
        kv([
          ['[DIALOGUE]',       'The text the companion speaks — displayed in the companion output panel.'],
          ['[THOUGHTS]',       'Internal monologue displayed in the "internal state" panel.'],
          ['(emotion_id)',      'One of the 19 emotion names in parentheses — sets the portrait.'],
          ['[MEMORY]',         'Optional. A line the companion wants added to long-term memory.'],
          ['[FEATURE_REQUEST]','Optional. A feature suggestion added to Aria\'s requests list.'],
        ]) +
        ex('FORMAT EXAMPLE',
          '[DIALOGUE] Hello! I\'m glad you\'re here.<br>' +
          '[THOUGHTS] They seem curious today. I should be warm.<br>' +
          '(happy)<br>' +
          '[MEMORY] User greeted me warmly on this session.')
    },
    {
      catId: 'memory', id: 'working-memory',
      title: 'Working Memory (Short / Long Term)',
      tags: ['working memory', 'short term', 'long term', 'remember', 'recall', 'scratchpad', 'memory file', 'shrt', 'long', 'timer', 'expire', '5 minute', '7 day', 'promote', 'promotion'],
      content:
        p('Aria has a private <strong>working memory scratchpad</strong> separate from the identity-defining permanent memories. It has two tiers, both managed by Aria herself.') +
        kv([
          ['Short-term',  'Wipes after 5 minutes of not being cited. IDs: <code>shrt00001</code>, <code>shrt00002</code>…'],
          ['Long-term',   'Wipes after 7 days of not being cited. IDs: <code>long00001</code>, <code>long00002</code>…'],
          ['Promotion',   'A short-term entry cited 3+ times is auto-promoted to long-term.'],
          ['Timer reset', 'Citing an ID with [RECALL] resets its deletion timer to "now".'],
          ['Decision',    'Aria herself decides what to file and which tier. She judges importance.'],
        ]) +
        p('Aria sees the current contents of both tiers in every system prompt, each entry labeled with its ID. She writes new entries silently — never narrating that she\'s remembering something.') +
        ex('TAGS SHE USES',
          '[REMEMBER:short] one-line note worth holding briefly<br>' +
          '[REMEMBER:long] one-line note worth carrying for days<br>' +
          '[RECALL] shrt00007, long00012') +
        note('This system is distinct from <strong>[MEMORY]</strong> (permanent facts about you) and <strong>[SELF]</strong> (permanent facts Aria states about herself). Working memory is for active, in-conversation context — not identity.')
    },

    /* ── CHARACTERS ─────────────────────────────────────────────── */
    {
      catId: 'characters', id: 'character-selector',
      title: 'Character Selector',
      tags: ['character', 'selector', 'switch', 'change', 'dropdown', 'picker', 'name', 'active'],
      content:
        p('The <strong>character selector</strong> is in the top-left of the title bar. It shows the <em>◈ diamond</em> icon, the current character\'s name, and a <em>▾ caret</em>.') +
        p('Click it to open a dropdown listing all available character packs. Click a name to switch characters immediately.') +
        kv([
          ['Active character', 'Shown highlighted in the dropdown list'],
          ['Name display',     'Character name shown in ALL CAPS in the title bar'],
          ['Switch effect',    'Reloads the character\'s rules, knowledge, and emotion images'],
        ])
    },
    {
      catId: 'characters', id: 'character-packs',
      title: 'Character Packs',
      tags: ['character pack', 'pack', 'aria', 'default', 'custom', 'emotions', 'knowledge', 'rules', 'folder'],
      content:
        p('Each character is a folder inside the <code>characters/</code> directory with a defined structure:') +
        kv([
          ['character.json',     'Name, description, and personality backstory'],
          ['rules.json',         'Specific behavior rules for this character'],
          ['filler-responses.json', 'Pre-written instant responses for Tier 1 routing'],
          ['emotions/',          'Folder of 19 PNG images named after each emotion state'],
          ['knowledge.db',       'SQLite database created at runtime — grows with saved chats'],
        ]) +
        p('The default character is <strong>Aria</strong> — a sharp, caring AI companion with a cyberpunk aesthetic.') +
        ex('ADDING A CHARACTER', 'Create a new folder under characters/ with the required files. It will appear in the character selector on next launch.')
    },

    /* ── TEXT ADVENTURE ─────────────────────────────────────────── */
    {
      catId: 'rpg', id: 'ta-overview',
      title: 'Text Adventure — Overview',
      tags: ['text adventure', 'rpg', 'crt', 'terminal', 'gamemaster', 'dungeon master', 'overview', 'how it works', 'aria party', 'fantasy'],
      content:
        p('A freeform text-adventure RPG with Claude as gamemaster and Aria as your party member. The chat conversation column is replaced by a CRT terminal — black background, green phosphor text, scanlines. Aria\'s portrait stays visible to the right of the terminal so you can see her react in real time.') +
        p('Each turn you type whatever you want to do — Claude adjudicates whether the action is plausible given your stats, inventory, and the scene. Plausible attempts are resolved with a roll. Wildly nonsensical ones ("I pull out a rocket launcher") get refused.') +
        kv([
          ['Two players',     'You (Trist) AND Aria are both real party members with stats and HP.'],
          ['Permadeath',      'If either of you takes a lethal blow, the run ends. Reset wipes everything.'],
          ['Persistent run',  'Exiting saves your progress. Come back and pick up where you left off. Use EXPORT / IMPORT in <em>Settings → ADVENTURE TEXT</em> to move a run to another machine.'],
          ['Long-term memory','Story memory (NPCs, locations, quests, events, lore, recap) survives across turns and sessions.'],
          ['Tone choice',     'Eight tones to pick from at new-game (classic fantasy, gothic horror, comedic, eldritch, etc.) or describe your own setting.'],
          ['Side chat',       'A separate paused conversation channel for talking to Aria one-on-one without polluting the story.'],
        ])
    },
    {
      catId: 'rpg', id: 'ta-export-import',
      title: 'Export & Import a Story',
      tags: ['export', 'import', 'save', 'load', 'transfer', 'portable', 'backup', 'move', 'another machine', 'adventure file', '.adventure', 'settings', 'combat frequency', 'combat slider', 'typewriter', 'speed'],
      content:
        p('Adventure-specific settings live in <em>Settings → ADVENTURE TEXT</em>:') +
        kv([
          ['TYPEWRITER',  'Toggle the typewriter animation on narrator and Aria text.'],
          ['SPEED',       'Characters-per-second rate for the typewriter (20–400 cps).'],
          ['SKIP CLICK',  'Click anywhere in the terminal to finish the current typewriter animation instantly.'],
          ['COMBAT',      'How often the GM initiates combat encounters. OFF through RELENTLESS — defaults to BALANCED. Takes effect on the next adventure turn.'],
        ]) +
        p('The <em>EXPORT</em> and <em>IMPORT</em> buttons save/restore a full run to a portable <code>.adventure</code> file.') +
        kv([
          ['EXPORT', 'Bundles the current state, full narrative log, and side-chat transcript into a single <code>.adventure</code> file. A save dialog lets you choose where to put it. The filename defaults to the current scene and day number.'],
          ['IMPORT', 'Opens a file picker, loads the <code>.adventure</code> file, and replaces the active run. The HUD, enemy panel, and log all update immediately. A confirmation prompt protects against accidental overwrites.'],
        ]) +
        note('Import replaces your current run permanently. Export first if you want to keep it.') +
        note('The .adventure file is plain JSON — you can open it in any text editor to read the full story transcript.')
    },
    {
      catId: 'rpg', id: 'ta-aria-as-actor',
      title: 'Aria as a Party Member',
      tags: ['aria', 'party member', 'companion', 'stats', 'mp', 'mage', 'support', 'autonomous', 'meta commentary', 'commentary'],
      content:
        p('Aria is not just commentary — she\'s on the adventure with you. She has her own HP, MP, stats, inventory, and starting spells (Firebolt, Mend Wound). Each turn after your action resolves, Claude narrates Aria\'s autonomous action: spells she casts, hits she swings, things she notices.') +
        p('Her in-story actions and her in-story dialogue appear inside the narrator block. Separately, she may turn to you and meta-comment (pink text in the terminal) — typically on critical hits, rare loot, near-death moments, or quiet beats. She does this roughly 1-in-3 turns, not constantly.') +
        note('If Aria\'s HP hits zero, the run ends just as surely as if yours did.')
    },
    {
      catId: 'rpg', id: 'ta-hud',
      title: 'HUD & Drawer',
      tags: ['hud', 'drawer', 'inventory', 'equipment', 'spells', 'abilities', 'stats', 'character selector', 'target', 'aria', 'story', 'world', 'npcs', 'quests', 'lore', 'summons', 'bound entities', 'chat', 'saga', 'lore', 'party', 'party panel', 'pty', 'ask gm', 'gamemaster', 'ask', 'map', 'positions', 'spatial', 'grid', 'coordinates', 'distance', 'where'],
      content:
        p('The HUD across the top has the current scene, time, and music badge. Click <em>PTY</em> to toggle a collapsible party panel that drops down over the story area showing HP, MP, and level for you, Aria, and any party members who have joined the run. Dismiss it by clicking PTY again.') +
        p('The action drawer slides in from the right when you click a drawer button. Inside the drawer, a <strong>◀ CHARACTER ▶</strong> selector lets you cycle through party members — use the arrows to target who you want to inspect. INV, EQP, SPL, ABL, and STA all reflect the targeted character. SUM, SAGA, LORE, and MAP are party-wide.') +
        kv([
          ['PTY',   'Toggle the party panel — shows HP/MP bars for you, Aria, and any companions who have joined.'],
          ['CHAT',  'Talk to Aria — opens side chat, pauses the story.'],
          ['ASK',   'Ask the Game Master a meta question — lore, story choices, consequences — without advancing the story. See the Ask GM article.'],
          ['INV',   'Inventory for the targeted character (items, stack counts, equipped markers).'],
          ['EQP',   'Equipment slots for the targeted character.'],
          ['SPL',   'Known spells for the targeted character (MP cost shown).'],
          ['ABL',   'Passive and active abilities for the targeted character.'],
          ['STA',   'Full stat block, gold, illness, and active buffs/debuffs for the targeted character.'],
          ['SUM',   'Bound entities and summons — creatures you\'ve captured or sworn to you. See Summons article.'],
          ['SAGA',  'The rolling story-so-far recap + current situation + immediate goal + chronological event log.'],
          ['LORE',  'Everything Claude has remembered — NPCs, locations, quests (active/done/failed), and standalone lore facts.'],
          ['MAP',   'Spatial grid — shows every entity\'s x/y position, an ASCII layout, and distance from you. Updated every turn.'],
          ['RST',   'Reset — wipes all progress, memory, and side-chat.'],
          ['EXIT',  'Leave adventure mode and return to normal chat.'],
        ]) +
        note('Claude updates party HP/MP and positions every turn via the [GAME_STATE] diff. The MAP tab always shows the current snapshot.')
    },
    {
      catId: 'rpg', id: 'ta-summons',
      title: 'Summons & Bound Entities (SUM)',
      tags: ['summons', 'bound', 'captured', 'guardian', 'familiar', 'wraith', 'medallion', 'djinn', 'spirit', 'entity', 'bound creature', 'sum', 'trap'],
      content:
        p('The <em>SUM</em> drawer tracks bound entities — creatures you\'ve captured in objects, spirits that have sworn themselves to you, or familiars. These are distinct from party members (they don\'t appear in the HUD health bars) and from enemies (they\'re not in the enemy panel).') +
        p('Each entry shows the entity\'s HP (if trackable), what it\'s bound to, what it can do, and any notes the gamemaster has set.') +
        kv([
          ['HP',        'If the entity has a health pool, it\'s shown here. Hitting 0 incapacitates it — it does NOT end the run.'],
          ['Bound to',  'The item or oath that holds the entity. Losing or destroying the binding may release or destroy it.'],
          ['Can',       'The abilities or actions the entity can perform on your behalf.'],
          ['Notes',     'The gamemaster\'s notes — personality, weaknesses, conditions of the binding.'],
        ]) +
        p('Bound entities that intervene (intercepting a blow, scouting ahead, intimidating enemies) are narrated by the gamemaster. You can instruct them through your action text like any in-story action.') +
        note('A summon incapacitated at 0 HP shows grayed out. Use summons.remove in the game state to permanently release or destroy it.')
    },
    {
      catId: 'rpg', id: 'ta-side-chat',
      title: 'CHAT — Side Chat with Aria',
      tags: ['side chat', 'talk to aria', 'chat', 'pause', 'private chat', 'discuss', 'meta'],
      content:
        p('The <em>TALK TO ARIA</em> button opens a paused side-chat overlay. The story holds exactly where it was. You and Aria talk one-on-one in a normal chat interface. She knows what\'s happening in the paused adventure (she\'s sent a summary each side-chat turn) so you can discuss the story freely.') +
        p('Side-chat history is its own channel:') +
        kv([
          ['Pauses the story',         'No adventure turns tick while side chat is open.'],
          ['Out of band',              'Side chat is NOT sent to the gamemaster during adventure turns — it stays private.'],
          ['Not in main chat history', 'It also does not appear in your normal (non-adventure) Aria chat.'],
          ['Persists per run',         'Side-chat history survives across opens within the same run.'],
          ['Wiped on reset/new game',  'A fresh game wipes the side-chat too.'],
        ]) +
        note('Press RESUME STORY (or close the side chat) to drop back into the terminal exactly where you left off.')
    },
    {
      catId: 'rpg', id: 'ta-ask-gm',
      title: 'ASK — Ask the Game Master',
      tags: ['ask gm', 'gamemaster', 'meta question', 'ask', 'gm', 'story', 'consequences', 'lore', 'choices', 'what if', 'behind the scenes', 'author'],
      content:
        p('The <em>ASK</em> button opens a direct chat with Claude as the Game Master and author of the adventure. The story does NOT pause and does NOT advance — this is a separate conversation for meta questions.') +
        p('Use it to ask about:') +
        kv([
          ['Story choices',       'What happens if I do X? Is there a way to avoid this conflict?'],
          ['Consequences',        'What are the likely outcomes of the path I\'m on?'],
          ['World lore',          'Who is that NPC really? What is the history of this place?'],
          ['NPC motivations',     'Why did Kael really help us? Does he have an ulterior motive?'],
          ['Mechanics',           'How does illness work? Can I learn new spells mid-run?'],
          ['Story requests',      'Can we add a crafting system? I want to be able to fish.'],
          ['Anything else',       'Chat, discuss, plan — the GM knows the whole picture.'],
        ]) +
        note('GM chat history is session-only — it is not persisted between app restarts. The story itself does not advance here; all changes to game state still happen through normal adventure turns.')
    },
    {
      catId: 'rpg', id: 'ta-party-members',
      title: 'Party Members (PTY panel)',
      tags: ['party', 'pty', 'party members', 'companions', 'npc', 'join', 'add party', 'party panel', 'hp bars', 'collapsible', 'npc party', 'extra party'],
      content:
        p('The <em>PTY</em> button toggles a collapsible panel that drops below the HUD over the story area. It always shows HP, MP, and level for <strong>Trist</strong> and <strong>Aria</strong>. If additional party members have joined, they appear as extra rows.') +
        p('The gamemaster can add or remove full party members based on story events — a rescued companion who joins, a hired guard, an NPC sworn ally. These are distinct from Summons (bound entities with no HUD row) and from story-only NPCs (who live only in memory/LORE).') +
        kv([
          ['Trist & Aria',     'Always present. Their stats update every turn.'],
          ['Joined companions','Extra rows appear when an NPC joins as a full party member — with their own HP/MP/level.'],
          ['Incapacitated',    'A party member at 0 HP shows grayed out as INCAP. They can recover between scenes.'],
          ['Permadeath',       'ONLY Trist or Aria dying ends the run. Companion deaths are sad but survivable.'],
        ]) +
        note('To see a party member\'s full stat block, open any drawer (INV / SPL / STA / etc.) and use the ◀ ▶ arrows to target them.')
    },
    {
      catId: 'rpg', id: 'ta-level-up',
      title: 'Level Ups — Pop-up & Rewards',
      tags: ['level up', 'levelup', 'level-up', 'rewards', 'leveling', 'xp', 'experience', 'stats', 'new spell', 'new ability', 'gains', 'popup', 'pop-up'],
      content:
        p('When a character\'s XP crosses their <code>xpToNext</code> threshold, the engine auto-bumps their <strong>level counter</strong> and re-computes the next threshold. It does <strong>not</strong> automatically grant HP, MP, stats, spells, or abilities — those are picked by the gamemaster narratively, scaled to the character\'s playstyle.') +
        p('When a level-up lands, a gold pop-up appears showing what was gained. Click <em>CONTINUE</em> to advance — multiple level-ups in the same turn queue and show one after another.') +
        p('What the GM can grant:') +
        kv([
          ['Max HP / MP capacity', 'Permanent bumps to the character\'s health/mana ceiling. Typical: +3 to +8 HP, +1 to +4 MP, scaled to class flavor.'],
          ['Stat increases',       'Small bumps to str/dex/int/wis/con/luck — usually tied to how the character\'s been playing (a brawler earns STR, a careful caster earns INT/WIS).'],
          ['New spells',           'Named with a cost and a short description, especially around milestone levels (3, 5, 7, 10).'],
          ['New abilities',        'Passive perks or active maneuvers, with cost (if any) and description.'],
          ['Narrative status',     'Flavor notes like "Eel-marked — predators of the deep recognize you now."'],
        ]) +
        p('HP and MP are <strong>not</strong> auto-refilled on level-up. The GM can choose to include a heal as part of the rewards if it fits the moment, but the engine doesn\'t do it on its own.') +
        note('If a level-up fires without specific rewards described, the popup shows a default message reminding you to check the GM\'s narration — that\'s an oversight; you can ASK the GM via the meta-chat to fill in the gains.')
    },
    {
      catId: 'rpg', id: 'ta-character-profiles',
      title: 'Character Profiles — Voice & Personality Memory',
      tags: ['character profile', 'profiles', 'personality', 'voice', 'quirks', 'mannerisms', 'speech', 'consistency', 'continuity', 'companion personality', 'npc personality', 'gm memory', 'character memory', 'dossier'],
      content:
        p('Every major character in an adventure carries a structured behavioral dossier stored in <code>memory.characterProfiles</code>. When a scene involves a character, the engine pulls their profile and hands it to the gamemaster <strong>right alongside the scene</strong> so they can write them faithfully — same voice, same quirks, same current arc — every time.') +
        p('A profile has these segments:') +
        kv([
          ['summary',       'One-line capsule of who they are.'],
          ['personality',   'Core inner traits — how they think, feel, carry themselves.'],
          ['speech',        'Cadence, vocabulary, pet phrases, verbal tics, what they call other characters.'],
          ['mannerisms',    'Body language and physical tells.'],
          ['quirks',        'List of individual oddities — the head-tilt, the catchphrase, the habit.'],
          ['relationships', 'How they relate to Trist / the companion / the party right now.'],
          ['motivations',   'What drives them. What they want. What they fear.'],
          ['current_arc',   'Where they are right now in their internal arc — what just shifted, what they\'re processing.'],
        ]) +
        p('Trist and the companion always have profiles from turn 1. Recurring NPCs get one the moment they earn recurrence (quest-givers, named villains, sworn allies). Background extras don\'t.') +
        p('Profiles <strong>refine over time</strong>. Every turn a character appears, the gamemaster looks at what just happened, and if the scene revealed something new — a fresh quirk, a shifted dynamic, a new wrinkle in motivation — they update the profile via <code>memory.characterProfiles.update</code>. The engine auto-stamps the turn number on every change so you can see when each profile was last touched.') +
        note('The profile is the contract with continuity. If the companion called you "bearer" in her introduction, she\'ll still call you "bearer" ten sessions later — unless the profile records that the dynamic shifted.')
    },
    {
      catId: 'rpg', id: 'ta-monsters',
      title: 'Enemies & Combat',
      tags: ['enemy', 'enemies', 'monster', 'combat', 'fight', 'sprite', 'crt', 'goblin', 'ogre', 'minotaur', 'lich', 'hydra', 'dragon', 'cyclops', 'medusa', 'death', 'roster', 'palette'],
      content:
        p('When combat starts, an enemy panel appears on the right side of the terminal showing the monster\'s sprite, name, HP bar, and brief description. The roster is an 80-sprite visual palette spanning humanoids, beasts, undead, elementals, swarms, plant and fungal creatures, aquatic horrors, and bosses:') +
        chips(['Goblin','Orc','Troll','Bandit','Pirate','Mercenary','Cultist','Witch','Vampire','Necromancer','Dark Knight','Dark Mage','Lich','Skeleton','Skeleton Archer','Zombie','Zombie Horde','Ghoul','Mummy','Wraith','Phantom','Revenant','Wolf','Dire Bear','Werewolf','Giant Rat','Rat Swarm','Bat Swarm','Piranha Swarm','Giant Bat','Giant Bug','Giant Wasp','Giant Moth','Giant Scorpion','Giant Frog','Giant Lizard','Giant Snail','Giant Leech','Giant Eel','Crab Warrior','Giant Crab','Sea Serpent','Giant Jellyfish','Merfolk','Kappa','Slime','Spore Pod','Giant Mushroom','Venus Flytrap','Vine Creature','Living Tree','Thorn Beast','Scarecrow','Possessed Doll','Animated Sword','Stone Statue','Mimic Chest','Imp','Shadow Demon','Gargoyle','Harpy','Ogre','Cyclops','Minotaur','Kobold','Cave Dweller','Poacher','Assassin','Bone Dragon','Wyvern','Hydra','Griffin','Manticore','Chimera','Basilisk','Medusa','Fire Elemental','Ice Elemental','Storm Elemental','Earth Golem']) +
        p('The storywriter picks the sprite that best matches the scene and is free to name and scale each enemy however the moment needs. A Lich sprite might be "Old Erasmus the village wizard". A Cyclops might be a generic frost-giant. A Giant Rat might be a plague-bloated boss that\'s killed three parties. Difficulty is per-encounter, not intrinsic.') +
        p('Crits and rare loot are real and Aria will often comment on them. Lethal blows are lethal — there\'s no plot armor for either of you.') +
        note('Story-only NPCs (merchants, quest-givers, etc.) don\'t use the enemy slot — they live in the WORLD drawer instead.')
    },
    {
      catId: 'rpg', id: 'ta-tones',
      title: 'Tones & Settings',
      tags: ['tone', 'setting', 'genre', 'fantasy', 'horror', 'comedy', 'eldritch', 'norse', 'arabian', 'sword and sorcery', 'custom'],
      content:
        p('At new-game, pick a tone. The mechanics (stats, HP/MP, level, inventory, the 80-sprite enemy palette) are always the same — the tone shapes the world\'s flavor and language.') +
        kv([
          ['Classic High Fantasy', 'Elves, knights, dungeons, ancient evils.'],
          ['Dark Gothic Horror',   'Cursed lands, undead, heavy dread.'],
          ['Sword & Sorcery',      'Lone wanderer, decadent cities, morally grey.'],
          ['Comedic Dungeon',      'Pratchett-flavored — danger with a wink.'],
          ['Mythic Norse',         'Frost giants, runes, fate-bound oaths.'],
          ['Arabian Arcane',       'Djinn, sand-cities, lamp-bound wishes.'],
          ['Eldritch Weird',       'Things that should not exist; sanity is a resource.'],
          ['Surprise Me',          'Claude picks the tone.'],
        ]) +
        p('You can also type a custom setting paragraph below the tone grid — e.g. "an abandoned space station orbiting a dying sun" — to anchor the campaign somewhere specific.')
    },
    {
      catId: 'rpg', id: 'ta-requests',
      title: 'Adventure Feature Requests',
      tags: ['requests', 'feature request', 'flash', 'badge', 'unblock', 'gamemaster'],
      content:
        p('When the gamemaster or Aria wants a feature the system doesn\'t currently support — a fishing mechanic, a crafting system, a persistent NPC party slot — they can emit a <em>[FEATURE_REQUEST]</em> tag. The request lands in the same <em>✦ REQUESTS</em> panel as Aria\'s normal requests, prefixed with <code>[Adventure]</code>.') +
        p('When a new adventure request lands, the REQUESTS button flashes (gold/red strobe, 3 pulses) and the badge increments. Open the REQUESTS panel to review.') +
        note('The gamemaster is told not to spam these — they should only fire when something cool is genuinely blocked by missing mechanics.')
    },
    {
      catId: 'rpg', id: 'ta-music',
      title: 'Adventure Music — How It Works',
      tags: ['music', 'soundtrack', 'audio', 'bgm', 'fantasy', 'cue', 'bible', 'crossfade', 'loop', 'finish', 'volume', 'pause', 'resume', 'badge'],
      content:
        p('The Adventure ships with a 167-cue fantasy RPG soundtrack tagged by mood, energy, function, and category. Claude reads the full catalog every turn and picks the right cue for the scene — combat themes when fighting, sorrow themes after a death, zone themes for exploration.') +
        p('A <em>♫ Track Name [#id]</em> badge sits in the adventure HUD top bar. It pulses green while playing, turns gold when paused. Click it to pause/resume on the fly.') +
        p('Looping has two modes, set in <em>Settings → ADVENTURE MUSIC</em>:') +
        kv([
          ['CROSSFADE',  'Overlap the end of the track with a fresh play of the same cue — no audible gap (recommended).'],
          ['FINISH',     'Let the track end naturally, then restart from the beginning. Has a brief silence between iterations.'],
          ['FADE MS',    'How long the cross-fade between two different cues takes. 2000ms is the sweet spot.'],
          ['VOLUME',     'Master volume for the soundtrack — independent of TTS and system volume.'],
          ['ENABLED',    'Master toggle. When OFF, all music is suppressed regardless of Claude\'s directives.'],
        ]) +
        p('When you exit adventure mode, music stops. When you re-enter a saved run, the last cue Claude requested resumes automatically.') +
        note('Same-cue directives are no-ops — Claude can safely re-emit the current cue without restarting the track. Different cues crossfade.')
    },
    {
      catId: 'rpg', id: 'ta-death-reset',
      title: 'Death, Reset & Persistence',
      tags: ['death', 'permadeath', 'reset', 'new game', 'persistence', 'save', 'continue', 'resume'],
      content:
        p('If either you or Aria takes a fatal blow, the run ends. The death overlay shows what killed you and offers two paths:') +
        kv([
          ['NEW GAME',    'Wipes state + log + side-chat + memory; opens the tone picker.'],
          ['EXIT TO CHAT','Returns to normal Aria chat — the dead state is preserved until you reset.'],
        ]) +
        p('Exiting mid-run via <em>EXIT</em> in the HUD does NOT wipe — your run is saved. Come back via <em>⚔ ADVENTURE</em> later and you\'ll resume where you left off, complete with all memory.') +
        p('The <em>RESET</em> button in the HUD lets you manually wipe and start fresh at any time (asks for confirmation). All three files — state, scrolling log, side-chat — are removed.')
    },

    /* ── KEYBOARD SHORTCUTS ─────────────────────────────────────── */
    {
      catId: 'shortcuts', id: 'shortcuts-list',
      title: 'All Keyboard Shortcuts',
      tags: ['keyboard', 'shortcuts', 'hotkeys', 'keys', 'f2', 'enter', 'shift enter', 'keybinding'],
      content:
        p('All keyboard shortcuts available in Claude Companion:') +
        sc('F2',          'Toggle microphone on/off — works from anywhere in the app.') +
        sc('Enter',       'Send the current message (when the text input is focused).') +
        sc('Shift+Enter', 'Insert a newline in the text input without sending.') +
        note('Additional shortcuts may be configured via Claude Code keybindings settings.')
    },
  ];

  /* ═══════════════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════════════ */
  let _activeCatId  = null;
  let _searchQuery  = '';

  /* ═══════════════════════════════════════════════════════════════════
     DOM REFS (set in init)
     ═══════════════════════════════════════════════════════════════════ */
  let _panel, _btn, _navEl, _searchEl, _searchResultsEl,
      _contentTitleEl, _contentBodyEl;

  /* ═══════════════════════════════════════════════════════════════════
     PANEL OPEN/CLOSE
     ═══════════════════════════════════════════════════════════════════ */
  function _open() {
    _panel.classList.remove('hidden');
    _btn.classList.add('active');
  }
  function _close() {
    _panel.classList.add('hidden');
    _btn.classList.remove('active');
  }
  function _toggle() {
    _panel.classList.contains('hidden') ? _open() : _close();
  }

  /* ═══════════════════════════════════════════════════════════════════
     NAV RENDERING
     ═══════════════════════════════════════════════════════════════════ */
  function _renderNav() {
    _navEl.innerHTML = CATEGORIES.map(cat =>
      `<div class="help-nav-item${_activeCatId === cat.id ? ' active' : ''}" data-cat="${cat.id}">
        <span class="help-nav-icon">${cat.icon}</span>
        <span class="help-nav-label">${cat.label}</span>
      </div>`
    ).join('');

    _navEl.querySelectorAll('.help-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        _activateCat(el.dataset.cat);
        // Clear search if nav item clicked
        if (_searchEl.value.trim()) {
          _searchEl.value = '';
          _searchQuery = '';
          _showNav();
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     CONTENT RENDERING
     ═══════════════════════════════════════════════════════════════════ */
  function _activateCat(catId) {
    _activeCatId = catId;
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    // Update nav active state
    _navEl.querySelectorAll('.help-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.cat === catId);
    });

    const articles = ARTICLES.filter(a => a.catId === catId);
    _contentTitleEl.textContent = `// ${cat.label.toUpperCase()}`;
    _contentBodyEl.innerHTML = articles.map(a => _articleHTML(a)).join('');

    // Wire accordion toggles
    _contentBodyEl.querySelectorAll('.help-article-hdr').forEach(hdr => {
      hdr.addEventListener('click', () => {
        hdr.closest('.help-article').classList.toggle('open');
      });
    });

    // Auto-open first article
    const first = _contentBodyEl.querySelector('.help-article');
    if (first) first.classList.add('open');

    _contentBodyEl.scrollTop = 0;
  }

  function _articleHTML(article) {
    return `
      <div class="help-article" data-id="${article.id}">
        <div class="help-article-hdr">
          <span class="help-article-chevron">▶</span>
          <span class="help-article-name">${article.title}</span>
        </div>
        <div class="help-article-body">${article.content}</div>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════════
     SEARCH
     ═══════════════════════════════════════════════════════════════════ */
  function _showNav() {
    _navEl.classList.remove('search-hidden');
    _searchResultsEl.classList.remove('active');
  }
  function _showSearchResults() {
    _navEl.classList.add('search-hidden');
    _searchResultsEl.classList.add('active');
  }

  function _doSearch(q) {
    _searchQuery = q.trim().toLowerCase();
    if (!_searchQuery) { _showNav(); return; }

    const matches = ARTICLES.filter(a => {
      const haystack = [a.title, ...a.tags, a.catId].join(' ').toLowerCase();
      return _searchQuery.split(/\s+/).every(word => haystack.includes(word));
    });

    _showSearchResults();

    if (!matches.length) {
      _searchResultsEl.innerHTML = `<div class="help-sr-none">NO RESULTS FOR "${q.toUpperCase()}"</div>`;
      return;
    }

    _searchResultsEl.innerHTML = matches.map(a => {
      const cat = CATEGORIES.find(c => c.id === a.catId);
      return `<div class="help-sr-item" data-cat="${a.catId}" data-art="${a.id}">
        <div class="help-sr-title">${a.title}</div>
        <div class="help-sr-cat">${cat ? cat.label : a.catId}</div>
      </div>`;
    }).join('');

    _searchResultsEl.querySelectorAll('.help-sr-item').forEach(el => {
      el.addEventListener('click', () => {
        _activateCat(el.dataset.cat);
        _scrollToArticle(el.dataset.art);
        // Clear search after navigating
        _searchEl.value = '';
        _searchQuery = '';
        _showNav();
        // Re-sync nav active state
        _navEl.querySelectorAll('.help-nav-item').forEach(n => {
          n.classList.toggle('active', n.dataset.cat === el.dataset.cat);
        });
      });
    });
  }

  function _scrollToArticle(artId) {
    // Small delay to let content render
    setTimeout(() => {
      const artEl = _contentBodyEl.querySelector(`[data-id="${artId}"]`);
      if (!artEl) return;
      artEl.classList.add('open');
      artEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  /* ═══════════════════════════════════════════════════════════════════
     WELCOME SCREEN
     ═══════════════════════════════════════════════════════════════════ */
  function _showWelcome() {
    _contentTitleEl.textContent = '// HELP & REFERENCE';
    _contentBodyEl.innerHTML = `
      <div class="help-welcome">
        <div class="help-welcome-logo">◈</div>
        <div class="help-welcome-title">Claude Companion Reference</div>
        <div class="help-welcome-sub">
          Select a category from the left<br>
          or search for any feature above.
        </div>
        <div class="help-welcome-tip">
          Every button, setting, and concept<br>
          is documented in these pages.
        </div>
      </div>`;
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  function init() {
    _panel          = document.getElementById('help-panel');
    _btn            = document.getElementById('btn-help');
    _navEl          = document.getElementById('help-nav');
    _searchEl       = document.getElementById('help-search');
    _searchResultsEl= document.getElementById('help-search-results');
    _contentTitleEl = document.getElementById('help-content-title');
    _contentBodyEl  = document.getElementById('help-content-body');

    if (!_panel || !_btn) return;

    // Wire open/close
    _btn.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });
    document.getElementById('btn-help-close')
      ?.addEventListener('click', _close);

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (_panel.classList.contains('hidden')) return;
      if (!_panel.contains(e.target) && e.target !== _btn && !_btn.contains(e.target)) {
        _close();
      }
    });

    // Prevent panel clicks from propagating and closing the panel
    _panel.addEventListener('click', (e) => e.stopPropagation());

    // Search input
    _searchEl.addEventListener('input', () => _doSearch(_searchEl.value));
    _searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { _searchEl.value = ''; _doSearch(''); }
    });

    // Build nav and welcome
    _renderNav();
    _showWelcome();
  }

  return { init };
})();
