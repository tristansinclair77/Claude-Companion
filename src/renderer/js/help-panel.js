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
    { id: 'rpg',        icon: '⚔',  label: 'RPG Adventure'       },
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
      tags: ['title bar', 'window', 'minimize', 'maximize', 'close', 'controls', 'frameless'],
      content:
        p('Claude Companion uses a custom frameless title bar. All window management is handled by buttons on the right side of the title bar.') +
        kv([
          ['─  Minimize',  'Minimize the window to the taskbar.'],
          ['□  Maximize',  'Toggle between maximized and restored window size.'],
          ['✕  Close',     'Exit the application.'],
          ['⚙  Settings',  'Open the Display Settings panel (visual packages, effects, TTS, etc.).'],
          ['?  Help',      'Open this help reference panel.'],
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
        p('The <em>EMOTION</em> button opens the <strong>emotion picker</strong> — a grid of all 19 emotion states. Clicking one tells the companion <strong>how you yourself are feeling</strong> right now.') +
        p('This emotional context is passed to the companion so she can be aware of and respond to your current mood — she may acknowledge it, adjust her tone, or react accordingly.') +
        note('This is your emotion, not hers. The companion still chooses her own emotional response naturally based on the conversation.') +
        p('Available emotions:') +
        chips(['neutral','happy','soft_smile','laughing','confident','smug','surprised','shocked','confused','thinking','concerned','sad','angry','determined','embarrassed','exhausted','pout','crying','lustful_desire'])
    },
    {
      catId: 'actions', id: 'btn-save-chat',
      title: '💾 SAVE CHAT — Long-Term Memory',
      tags: ['save', 'chat', 'memory', 'long term', 'persist', 'remember', 'knowledge', 'database'],
      content:
        p('The <em>SAVE CHAT</em> button writes the current conversation into the companion\'s <strong>long-term memory database</strong>. Saved memories persist across sessions and can influence future responses.') +
        p('The local brain uses these saved conversations to answer similar questions without hitting the API — saving quota and responding instantly.') +
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
      tags: ['persona', 'personality', 'directive', 'override', 'temporary', 'mood', 'role', 'behave'],
      content:
        p('The <em>PERSONA</em> button opens a popup where you can type a <strong>temporary personality directive</strong> — a plain-language description of how you want the companion to behave.') +
        kv([
          ['APPLY',   'Activates the directive immediately for all subsequent messages'],
          ['CLEAR',   'Removes the directive — reverts to the character\'s default personality'],
          ['Scope',   'Directive persists for the rest of the session until cleared'],
          ['Priority','Overrides the character\'s default rules'],
        ]) +
        ex('EXAMPLES',
          '"Be more cold and aloof today"<br>' +
          '"You\'re in an extremely playful mood"<br>' +
          '"Respond like a grumpy AI that is reluctant to help"') +
        note('The directive is injected into the system prompt on every Claude call while active.')
    },
    {
      catId: 'actions', id: 'btn-adventure',
      title: '⚔ ADVENTURE — RPG Addon',
      tags: ['adventure', 'rpg', 'quest', 'panel', 'inventory', 'stats', 'game', 'addon'],
      content:
        p('The <em>ADVENTURE</em> button opens the <strong>RPG Adventure panel</strong> — an addon that transforms interactions into a role-playing game.') +
        p('The panel tracks inventory, quests, and character stats. Adventure events can be triggered during normal conversation and the companion participates as a game character.') +
        note('The RPG Adventure panel is a separate window — it runs alongside the main companion interface.')
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
      title: 'The 19 Emotions',
      tags: ['emotions', 'list', 'states', 'neutral', 'happy', 'sad', 'angry', 'laughing', 'crying', 'all emotions'],
      content:
        p('The companion expresses one of 19 emotion states at any given time. Each state has a corresponding portrait image.') +
        chips(['neutral','happy','soft_smile','laughing','confident','smug','surprised','shocked','confused','thinking','concerned','sad','angry','determined','embarrassed','exhausted','pout','crying','lustful_desire']) +
        p('The companion chooses its emotion automatically based on the conversation context, expressed as an <strong>emotion code</strong> in the raw response format. Use the <em>😊 EMOTION</em> button to tell the companion how <em>you</em> are feeling.')
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
      tags: ['visual package', 'package', 'theme', 'cybernetic', 'fantasy', 'rpg', 'arcade', 'cabinet', 'appearance', 'skin'],
      content:
        p('A <strong>Visual Package</strong> is a complete UI theme that controls background effects, ambient animations, and which settings sections are available. Select one from the top of the settings panel.') +
        kv([
          ['Cybernetic',     'Neon cyan/purple grid aesthetic. Features: background grid, film grain, overlay effects (data rain, circuit traces, edge glow, chromatic aberration), scanlines, VU bounce on emotion meters.'],
          ['Fantasy RPG',    'Warm parchment-and-ink medieval aesthetic. Features: seasonal weather effects (snow, rain, sun, leaves), parchment overlay.'],
          ['Arcade Cabinet', 'Retro gaming cabinet look. Features: TV glass surface, pixel-art arcade bezel, five random mini-game events (Space Invaders, Asteroids, Pong, Side Scroller, Pac-Man), ambient pixel effects.'],
        ]) +
        note('Settings sections that belong to a package are hidden automatically when that package is not active.')
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

    /* ── RPG ADVENTURE ──────────────────────────────────────────── */
    {
      catId: 'rpg', id: 'rpg-overview',
      title: 'RPG Adventure Overview',
      tags: ['rpg', 'adventure', 'role playing', 'game', 'quest', 'inventory', 'stats', 'panel', 'addon'],
      content:
        p('The <strong>RPG Adventure</strong> is an addon that layers a role-playing game on top of normal conversation. Access it with the <em>⚔ ADVENTURE</em> button.') +
        p('The addon opens in a separate panel and provides:') +
        kv([
          ['Inventory',  'Track items the companion acquires during role-play.'],
          ['Quests',     'Active and completed quest objectives.'],
          ['Stats',      'Character statistics that evolve through play.'],
          ['Events',     'Adventure events triggered during regular conversation.'],
        ]) +
        note('The RPG Adventure is an addon and may not be present in all builds. The button is hidden if the addon is not loaded.')
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
