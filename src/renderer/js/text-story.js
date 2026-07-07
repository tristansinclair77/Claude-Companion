// Text Story — narrative-only game mode.
//
// Runs entirely independently of the Aria companion. No portrait, no
// emotional axes, no memories piped in. Just the Storyteller and the story.
//
// Exposes window.TextStory with { init(), toggle() }. On first init the
// module injects its DOM into #text-story. On toggle, it flips `body.story-mode`
// and (if entering) shows the library overlay.

(function () {
  const $ = (id) => document.getElementById(id);

  // ── State ────────────────────────────────────────────────────────────
  let _initialized   = false;
  let _catalogs      = null;   // { storyTypes, segmentLengths, choiceFrequencies, nsfwLevels, defaults }
  let _currentSlug   = null;
  let _state         = null;
  let _log           = [];
  let _busy          = false;
  let _updateOff     = null;   // unsubscribe fn from storyAPI.onUpdate
  let _askHistory    = [];
  let _askBusy       = false;
  let _compHistory   = [];
  let _compBusy      = false;
  let _inspectSnapshot = null;
  let _inspectActiveTab = 'prompt';
  // Characters tab split view: which character + which sub-tab
  let _charSelected = null;
  let _charSubTab   = 'visual';
  const CHAR_SUBTABS = [
    { id: 'visual',        label: 'VISUAL' },
    { id: 'outfits',       label: 'OUTFITS' },
    { id: 'quirks',        label: 'QUIRKS' },
    { id: 'voice',         label: 'VOICE' },
    { id: 'health',        label: 'HEALTH' },
    { id: 'relationships', label: 'RELATIONSHIPS' },
    { id: 'prompts',       label: 'AI PROMPTS' },
  ];
  let _reactions       = [];   // full history in memory
  let _bookmarks       = [];
  let _portraits       = {};   // { characterId: absolutePath }
  // Inspector: BLUEPRINT and STATE tabs default to structured display;
  // toggling to true swaps them to raw-JSON dumps. See STORY_GUIDELINES_PATCH §7.2b.
  let _showRawJson     = false;
  // Split-pane selection for CHAPTER SUMMARIES / EVENT SUMMARIES tabs.
  let _chapterSummarySelected = null;
  let _eventSummarySelected   = null;
  let _proseScale      = parseFloat(localStorage.getItem('story-prose-scale') || '1');
  let _searchMatches   = [];
  let _searchIndex     = 0;

  // ── DOM injection ────────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    if (!window.storyAPI) {
      console.warn('[TextStory] storyAPI not exposed — story mode disabled.');
      return;
    }
    const root = $('text-story');
    if (!root) {
      console.warn('[TextStory] #text-story not found in DOM.');
      return;
    }
    root.innerHTML = _rootHtml();
    // Strip the initial `hidden` class from the HTML — hiding is now
    // handled by `body:not(.story-mode) #text-story { display: none }`
    // in text-story.css. Without this, the global `.hidden { display: none }`
    // rule in main.css keeps the panel invisible even in story mode.
    root.classList.remove('hidden');
    _wireEvents();
    _initialized = true;
  }

  // ── Top-level DOM template ───────────────────────────────────────────
  function _rootHtml() {
    return `
      <div class="story-header">
        <div class="story-header-row story-header-row-title">
          <div class="story-header-title" id="story-header-title">—</div>
          <div class="story-header-meta">
            <span class="story-header-section" id="story-header-section">Section 0</span>
            <span class="story-header-sep">·</span>
            <span class="story-header-chapter" id="story-header-chapter">Chapter —</span>
            <span class="story-header-sep">·</span>
            <span class="story-header-scene" id="story-header-scene">—</span>
          </div>
        </div>
        <div class="story-header-row story-header-row-actions">
          <button class="story-btn" id="story-btn-ask" title="Talk to the Storyteller out-of-story">📖 ASK</button>
          <!-- NUDGE feature disabled per STORY_GUIDELINES_PATCH. Handler stays wired
               so the underlying IPC keeps working, but the button is not visible. -->
          <button class="story-btn" id="story-btn-nudge" style="display:none" title="Steer the story with a note for the Storyteller (respected on the next turn)">🎯 NUDGE</button>
          <button class="story-btn" id="story-btn-companion" title="Chat with your companion about the story (they've been reading along)">💬 COMPANION</button>
          <button class="story-btn build-debug-only" id="story-btn-inspect" title="Debug view — reveals the story blueprint and everything the Storyteller sees. Use for testing; spoils the story.">🔍 INSPECT</button>
          <button class="story-btn" id="story-btn-settings" title="Change story settings (length, style, NSFW, etc.)">⚙ SETTINGS</button>
          <button class="story-btn" id="story-btn-library" title="Return to story library">📚 LIBRARY</button>
          <button class="story-btn" id="story-btn-retry" title="Undo last turn and try again">↺ RETRY</button>
          <button class="story-btn story-btn-danger" id="story-btn-exit" title="Exit story mode">✕ EXIT</button>
        </div>
      </div>

      <!-- Report banner (STORY_GUIDELINES_PATCH §6). Loud & sticky until dismissed. -->
      <div class="story-report-banner hidden" id="story-report-banner">
        <div class="story-report-banner-icon">⚠</div>
        <div class="story-report-banner-text">
          <div class="story-report-banner-title" id="story-report-banner-title">STORYTELLER REPORT</div>
          <div class="story-report-banner-body" id="story-report-banner-body">—</div>
        </div>
        <div class="story-report-banner-actions">
          <button class="story-btn story-btn-small" id="story-btn-report-open">OPEN REPORTS</button>
          <button class="story-btn story-btn-small" id="story-btn-report-dismiss">✕ DISMISS</button>
        </div>
      </div>

      <div class="story-main">
        <div class="story-main-left">
          <div class="story-scroll" id="story-scroll"></div>

          <div class="story-input-area">
            <div class="story-input-row">
              <textarea id="story-input" placeholder="Type an action, or press CONTINUE to let the story flow…" spellcheck="false" rows="2"></textarea>
              <div class="story-input-buttons">
                <button class="story-btn story-btn-primary" id="story-btn-send" title="Submit your action">SEND</button>
                <button class="story-btn" id="story-btn-continue" title="Let the story continue naturally">CONTINUE ▶</button>
              </div>
            </div>
          </div>
        </div>

        <div class="story-main-right">
          <div class="story-sidebar">
            <div class="story-sidebar-card">
              <div class="story-sidebar-card-label">CHAPTER</div>
              <div class="story-sidebar-chapter-num" id="story-sidebar-chapter-num">—</div>
              <div class="story-sidebar-chapter-title" id="story-sidebar-chapter-title">—</div>
            </div>
            <div class="story-sidebar-card">
              <div class="story-sidebar-card-label">SCENE</div>
              <div class="story-sidebar-scene-name" id="story-sidebar-scene-name">—</div>
              <div class="story-sidebar-scene-loc" id="story-sidebar-scene-loc"></div>
            </div>
            <div class="story-sidebar-card story-pacing-card hidden" id="story-pacing-card">
              <div class="story-sidebar-card-label">PACING</div>
              <div class="story-pacing-body" id="story-pacing-body">—</div>
            </div>
            <div class="story-sidebar-card story-scene-chars-card hidden" id="story-scene-chars-card">
              <div class="story-sidebar-card-label">SCENE CHARACTERS</div>
              <div class="story-scene-chars-list" id="story-scene-chars-list"></div>
            </div>
            <div class="story-choices hidden" id="story-choices">
              <div class="story-choices-label">
                YOUR CHOICES
                <button class="story-choices-suggest-btn" id="story-btn-suggest" title="Ask your companion which choice to pick">?</button>
              </div>
              <div class="story-choices-list" id="story-choices-list"></div>
              <div class="story-suggest-result hidden" id="story-suggest-result"></div>
            </div>
            <div class="story-reactions-panel hidden" id="story-reactions-panel">
              <div class="story-reactions-label">
                <span id="story-reactions-label-name">REACTIONS</span>
                <button class="story-reactions-clear-btn" id="story-btn-reactions-clear" title="Hide reactions panel">×</button>
              </div>
              <div class="story-reactions-list" id="story-reactions-list"></div>
            </div>
            <div class="story-sidebar-buttons">
              <button class="story-sidebar-btn" id="story-sidebar-btn-summary">
                <span class="story-sidebar-btn-ico">📜</span>
                <span class="story-sidebar-btn-label">STORY SO FAR</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-characters">
                <span class="story-sidebar-btn-ico">👥</span>
                <span class="story-sidebar-btn-label">CHARACTERS</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-locations">
                <span class="story-sidebar-btn-ico">🗺</span>
                <span class="story-sidebar-btn-label">PLACES</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-events">
                <span class="story-sidebar-btn-ico">⚡</span>
                <span class="story-sidebar-btn-label">RECENT EVENTS</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-chapters">
                <span class="story-sidebar-btn-ico">📖</span>
                <span class="story-sidebar-btn-label">CHAPTER JUMP</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-bookmarks">
                <span class="story-sidebar-btn-ico">🔖</span>
                <span class="story-sidebar-btn-label">BOOKMARKS</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-stats">
                <span class="story-sidebar-btn-ico">📊</span>
                <span class="story-sidebar-btn-label">STORY STATS</span>
              </button>
              <button class="story-sidebar-btn" id="story-sidebar-btn-export">
                <span class="story-sidebar-btn-ico">💾</span>
                <span class="story-sidebar-btn-label">EXPORT PROSE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Search bar (Ctrl+F toggle) -->
      <div class="story-search-bar hidden" id="story-search-bar">
        <input type="text" id="story-search-input" placeholder="Search this story… (Enter jumps to next match, Esc closes)" />
        <span class="story-search-count" id="story-search-count"></span>
        <button class="story-btn story-btn-small" id="story-btn-search-prev" title="Previous match">▲</button>
        <button class="story-btn story-btn-small" id="story-btn-search-next" title="Next match">▼</button>
        <button class="story-btn story-btn-small" id="story-btn-search-close" title="Close (Esc)">✕</button>
      </div>

      <!-- Busy overlay -->
      <div class="story-overlay story-overlay-busy hidden" id="story-overlay-busy">
        <div class="story-busy-inner">
          <div class="story-busy-spinner"></div>
          <div class="story-busy-label" id="story-busy-label">The Storyteller is writing…</div>
        </div>
      </div>

      <!-- Library overlay -->
      <div class="story-overlay hidden" id="story-overlay-library">
        <div class="story-overlay-panel">
          <div class="story-overlay-title">STORY LIBRARY</div>
          <div class="story-library-list" id="story-library-list"></div>
          <div class="story-overlay-actions">
            <button class="story-btn story-btn-primary" id="story-btn-new">+ NEW STORY</button>
            <button class="story-btn" id="story-btn-library-close">CLOSE</button>
          </div>
        </div>
      </div>

      <!-- New Story wizard -->
      <div class="story-overlay hidden" id="story-overlay-new">
        <div class="story-overlay-panel story-overlay-panel-wide">
          <div class="story-overlay-title">NEW STORY</div>

          <div class="story-form-group">
            <label class="story-form-label">Title <span class="story-form-hint">(optional — leave blank and the Storyteller invents one)</span></label>
            <input type="text" id="story-new-title" placeholder="e.g. The Hollow Crown — or leave blank" maxlength="80" />
          </div>

          <div class="story-form-group">
            <label class="story-form-label">Story Type</label>
            <div class="story-type-grid" id="story-new-type-grid"></div>
          </div>

          <div class="story-form-group">
            <label class="story-form-label">Story Length <span class="story-form-hint">(how much book you're signing up for)</span></label>
            <div class="story-type-grid" id="story-new-length-grid"></div>
            <div class="story-form-hint-inline" id="story-new-length-hint">A section is roughly one to two pages of a printed book.</div>
          </div>

          <div class="story-form-row">
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Main character name <span class="story-form-hint">(optional)</span></label>
              <input type="text" id="story-new-mc-name" placeholder="leave blank to let Storyteller pick" maxlength="40" />
            </div>
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Gender <span class="story-form-hint">(optional)</span></label>
              <input type="text" id="story-new-mc-gender" placeholder="anything — man / woman / nonbinary / etc." maxlength="40" />
            </div>
          </div>

          <div class="story-form-group">
            <label class="story-form-label">Starting context <span class="story-form-hint">(optional — seeds the opening scene)</span></label>
            <textarea id="story-new-context" placeholder="e.g. &quot;I want to play a rogue in a rain-soaked port city on the eve of a smuggler's war.&quot;&#10;Leave blank to let the Storyteller freewheel entirely." maxlength="1500" rows="3"></textarea>
          </div>

          <div class="story-overlay-title" style="margin-top:16px">SETTINGS</div>
          <div class="story-form-row">
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Segment length</label>
              <select id="story-new-seg"></select>
              <div class="story-form-hint-inline" id="story-new-seg-hint"></div>
            </div>
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Choice frequency</label>
              <select id="story-new-choicefreq"></select>
              <div class="story-form-hint-inline" id="story-new-choicefreq-hint"></div>
            </div>
          </div>
          <div class="story-form-row">
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Descriptiveness <span class="story-form-hint" id="story-new-desc-val">3</span></label>
              <input type="range" id="story-new-desc" min="1" max="5" step="1" value="3" />
              <div class="story-form-hint-inline">1 = minimal · 5 = lavish sensory detail</div>
            </div>
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Prose style <span class="story-form-hint" id="story-new-prose-val">3</span></label>
              <input type="range" id="story-new-prose" min="1" max="5" step="1" value="3" />
              <div class="story-form-hint-inline">1 = raw · 5 = flowery / literary</div>
            </div>
          </div>
          <div class="story-form-group">
            <label class="story-form-label">Content level (NSFW)</label>
            <select id="story-new-nsfw"></select>
            <div class="story-form-hint-inline" id="story-new-nsfw-hint"></div>
          </div>

          <div class="story-overlay-actions">
            <button class="story-btn story-btn-primary" id="story-btn-new-start">BEGIN STORY</button>
            <button class="story-btn" id="story-btn-new-cancel">CANCEL</button>
          </div>
        </div>
      </div>

      <!-- Settings overlay (per-story, editable at any time) -->
      <div class="story-overlay hidden" id="story-overlay-settings">
        <div class="story-overlay-panel">
          <div class="story-overlay-title">STORY SETTINGS</div>
          <div class="story-form-row">
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Segment length</label>
              <select id="story-set-seg"></select>
              <div class="story-form-hint-inline" id="story-set-seg-hint"></div>
            </div>
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Choice frequency</label>
              <select id="story-set-choicefreq"></select>
              <div class="story-form-hint-inline" id="story-set-choicefreq-hint"></div>
            </div>
          </div>
          <div class="story-form-row">
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Descriptiveness <span class="story-form-hint" id="story-set-desc-val">3</span></label>
              <input type="range" id="story-set-desc" min="1" max="5" step="1" value="3" />
            </div>
            <div class="story-form-group story-form-half">
              <label class="story-form-label">Prose style <span class="story-form-hint" id="story-set-prose-val">3</span></label>
              <input type="range" id="story-set-prose" min="1" max="5" step="1" value="3" />
            </div>
          </div>
          <div class="story-form-group">
            <label class="story-form-label">Content level (NSFW)</label>
            <select id="story-set-nsfw"></select>
            <div class="story-form-hint-inline" id="story-set-nsfw-hint"></div>
          </div>
          <div class="story-overlay-actions">
            <button class="story-btn story-btn-primary" id="story-btn-set-save">SAVE</button>
            <button class="story-btn" id="story-btn-set-cancel">CANCEL</button>
          </div>
        </div>
      </div>

      <!-- Sidebar info overlays (Story So Far / Characters / Places / Events) -->
      <div class="story-overlay hidden" id="story-overlay-info">
        <div class="story-overlay-panel story-overlay-panel-wide">
          <div class="story-overlay-title" id="story-info-title">—</div>
          <div class="story-info-body" id="story-info-body"></div>
          <div class="story-overlay-actions">
            <button class="story-btn" id="story-btn-info-close">CLOSE</button>
          </div>
        </div>
      </div>

      <!-- Debug Inspector overlay -->
      <div class="story-overlay hidden" id="story-overlay-inspect">
        <div class="story-overlay-panel story-overlay-panel-wide story-inspect-panel">
          <div class="story-overlay-title">
            🔍 STORY INSPECTOR
            <div class="story-overlay-subtitle">Everything the Storyteller sees + reads. Use for testing. SPOILS the story.</div>
          </div>
          <div class="story-inspect-tabs" id="story-inspect-tabs">
            <button class="story-inspect-tab story-inspect-tab-active" data-tab="prompt">NEXT PROMPT</button>
            <button class="story-inspect-tab" data-tab="overview">STORY OVERVIEW</button>
            <button class="story-inspect-tab" data-tab="chapter-summaries">CHAPTER SUMMARIES</button>
            <button class="story-inspect-tab" data-tab="event-summaries">EVENT SUMMARIES</button>
            <button class="story-inspect-tab" data-tab="reports">REPORTS</button>
            <button class="story-inspect-tab" data-tab="characters">CHARACTERS</button>
            <button class="story-inspect-tab" data-tab="chapters">CHAPTERS</button>
            <button class="story-inspect-tab" data-tab="blueprint">BLUEPRINT</button>
            <button class="story-inspect-tab" data-tab="state">STATE</button>
            <button class="story-inspect-tab" data-tab="last-turn">LAST TURN</button>
            <button class="story-inspect-tab" data-tab="last-blueprint">LAST BLUEPRINT</button>
            <button class="story-inspect-tab" data-tab="last-details">LAST DETAILS</button>
            <button class="story-inspect-tab" data-tab="log">LOG</button>
          </div>
          <div class="story-inspect-toolbar">
            <div class="story-inspect-meta" id="story-inspect-meta"></div>
            <button class="story-btn story-btn-small" id="story-btn-inspect-regen-plan" title="Re-run the setup chain (story overview + chapter + event summaries) for this story.">↻ REGEN PLAN</button>
            <button class="story-btn story-btn-small" id="story-btn-inspect-regen-details" title="Regenerate the CHARACTERS + CHAPTERS deep details from scratch">↻ REGEN DETAILS</button>
            <button class="story-btn story-btn-small" id="story-btn-inspect-raw-toggle" title="Toggle raw-JSON display on structured tabs">{ } RAW JSON</button>
            <button class="story-btn story-btn-small" id="story-btn-inspect-copy">📋 COPY</button>
          </div>
          <div class="story-inspect-content" id="story-inspect-content"></div>
          <div class="story-overlay-actions">
            <button class="story-btn" id="story-btn-inspect-refresh">↻ REFRESH</button>
            <button class="story-btn" id="story-btn-inspect-close">CLOSE</button>
          </div>
        </div>
      </div>

      <!-- Nudge overlay -->
      <div class="story-overlay hidden" id="story-overlay-nudge">
        <div class="story-overlay-panel">
          <div class="story-overlay-title">
            🎯 NUDGE THE STORYTELLER
            <div class="story-overlay-subtitle">A one-shot steering note. Applied on your next turn, then cleared.</div>
          </div>
          <div class="story-form-group">
            <label class="story-form-label">Nudge</label>
            <textarea id="story-nudge-input" placeholder="e.g. &quot;Focus more on the barkeep — I think he's the real villain.&quot; or &quot;Make the next scene take place at night, in the rain.&quot; or &quot;The story is dragging — pick up the pace and get us to the confrontation.&quot;" rows="5" maxlength="800"></textarea>
            <div class="story-form-hint-inline">The Storyteller MUST reflect this in the next turn (or begin steering toward it right away). Fires once, then clears.</div>
          </div>
          <div id="story-nudge-current" class="story-nudge-current hidden">
            <div class="story-nudge-current-label">Currently queued:</div>
            <div class="story-nudge-current-body" id="story-nudge-current-body"></div>
          </div>
          <div class="story-overlay-actions">
            <button class="story-btn story-btn-primary" id="story-btn-nudge-apply">APPLY NUDGE</button>
            <button class="story-btn" id="story-btn-nudge-clear">CLEAR QUEUED</button>
            <button class="story-btn" id="story-btn-nudge-close">CANCEL</button>
          </div>
        </div>
      </div>

      <!-- Companion chat overlay -->
      <div class="story-overlay hidden" id="story-overlay-companion">
        <div class="story-overlay-panel story-overlay-panel-wide story-ask-panel">
          <div class="story-overlay-title">
            💬 CHAT WITH YOUR COMPANION
            <div class="story-overlay-subtitle">They've been reading along with you. React to plot beats, guess where things are going, share what you think.</div>
          </div>
          <div class="story-ask-scroll" id="story-comp-scroll"></div>
          <div class="story-ask-input-row">
            <textarea id="story-comp-input" placeholder="e.g. &quot;Holy cow, did you SEE that?! I had no idea they were going to kill him off!&quot;" spellcheck="false" rows="2"></textarea>
            <button class="story-btn story-btn-primary" id="story-btn-comp-send">SEND</button>
          </div>
          <div class="story-overlay-actions">
            <button class="story-btn" id="story-btn-comp-clear">CLEAR CHAT</button>
            <button class="story-btn" id="story-btn-comp-close">CLOSE</button>
          </div>
        </div>
      </div>

      <!-- Ask Storyteller overlay -->
      <div class="story-overlay hidden" id="story-overlay-ask">
        <div class="story-overlay-panel story-overlay-panel-wide story-ask-panel">
          <div class="story-overlay-title">
            ASK THE STORYTELLER
            <div class="story-overlay-subtitle">Talk about the story outside the story. Corrections applied here will update the world.</div>
          </div>
          <div class="story-ask-scroll" id="story-ask-scroll"></div>
          <div class="story-ask-input-row">
            <textarea id="story-ask-input" placeholder="Ask about anything that's happened, any character or place — or tell the Storyteller they got something wrong." spellcheck="false" rows="2"></textarea>
            <button class="story-btn story-btn-primary" id="story-btn-ask-send">SEND</button>
          </div>
          <div class="story-overlay-actions">
            <button class="story-btn" id="story-btn-ask-clear">CLEAR CHAT</button>
            <button class="story-btn" id="story-btn-ask-close">CLOSE</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Event wiring ─────────────────────────────────────────────────────
  function _wireEvents() {
    // Header
    $('story-btn-ask').addEventListener('click', _openAsk);
    $('story-btn-nudge').addEventListener('click', _openNudge);
    $('story-btn-companion').addEventListener('click', _openCompanion);
    $('story-btn-inspect').addEventListener('click', _openInspect);
    $('story-btn-settings').addEventListener('click', _openSettings);
    $('story-btn-library').addEventListener('click', _openLibrary);
    $('story-btn-retry').addEventListener('click', _retryTurn);
    $('story-btn-exit').addEventListener('click', () => _exit());

    // Sidebar
    $('story-sidebar-btn-summary').addEventListener('click',    () => _openInfo('summary'));
    $('story-sidebar-btn-characters').addEventListener('click', () => _openInfo('characters'));
    $('story-sidebar-btn-locations').addEventListener('click',  () => _openInfo('locations'));
    $('story-sidebar-btn-events').addEventListener('click',     () => _openInfo('events'));
    $('story-sidebar-btn-chapters').addEventListener('click',   () => _openInfo('chapters'));
    $('story-sidebar-btn-bookmarks').addEventListener('click',  () => _openInfo('bookmarks'));
    $('story-sidebar-btn-stats').addEventListener('click',      () => _openInfo('stats'));
    $('story-sidebar-btn-export').addEventListener('click',     _openExport);
    $('story-btn-info-close').addEventListener('click', () => _showOverlay('story-overlay-info', false));

    // Suggest choice + reactions
    $('story-btn-suggest').addEventListener('click', _requestSuggestChoice);
    $('story-btn-reactions-clear').addEventListener('click', () => {
      $('story-reactions-panel').classList.add('hidden');
    });

    // Search bar + reading zoom (Ctrl+F, Ctrl+/-, Esc)
    document.addEventListener('keydown', _handleGlobalKeydown);
    $('story-search-input').addEventListener('input', _updateSearchMatches);
    $('story-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter')     { e.preventDefault(); _searchNext(1); }
      else if (e.key === 'Escape') { _closeSearch(); }
    });
    $('story-btn-search-prev').addEventListener('click', () => _searchNext(-1));
    $('story-btn-search-next').addEventListener('click', () => _searchNext(1));
    $('story-btn-search-close').addEventListener('click', _closeSearch);

    // Apply saved prose scale
    _applyProseScale();

    // Debug Inspector
    $('story-btn-inspect-close').addEventListener('click',   () => _showOverlay('story-overlay-inspect', false));
    $('story-btn-inspect-refresh').addEventListener('click', () => _openInspect());
    $('story-btn-inspect-copy').addEventListener('click',    _copyInspectContent);
    $('story-btn-inspect-regen-details').addEventListener('click', _regenerateDetails);
    $('story-btn-inspect-regen-plan').addEventListener('click',    _regeneratePlan);
    $('story-btn-inspect-raw-toggle').addEventListener('click',    _toggleRawJson);
    document.querySelectorAll('#story-inspect-tabs .story-inspect-tab').forEach((tab) => {
      tab.addEventListener('click', () => _switchInspectTab(tab.getAttribute('data-tab')));
    });

    // Report banner (STORY_GUIDELINES_PATCH §6.2)
    $('story-btn-report-dismiss').addEventListener('click', () => {
      $('story-report-banner').classList.add('hidden');
    });
    $('story-btn-report-open').addEventListener('click', () => {
      $('story-report-banner').classList.add('hidden');
      _openInspect().then(() => _switchInspectTab('reports'));
    });
    if (window.storyAPI && typeof window.storyAPI.onReport === 'function') {
      window.storyAPI.onReport((payload) => {
        if (!payload || !payload.report) return;
        _showReportBanner(payload.report);
      });
    }

    // Bottom bar
    $('story-btn-send').addEventListener('click', _sendFreeform);
    $('story-btn-continue').addEventListener('click', _sendContinue);
    $('story-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendFreeform();
      }
    });

    // Library
    $('story-btn-library-close').addEventListener('click', () => _showOverlay('story-overlay-library', false));
    $('story-btn-new').addEventListener('click', _openNewStoryWizard);

    // New story
    $('story-btn-new-start').addEventListener('click', _createNewStory);
    $('story-btn-new-cancel').addEventListener('click', () => {
      _showOverlay('story-overlay-new', false);
      _showOverlay('story-overlay-library', true);
    });
    $('story-new-desc').addEventListener('input', (e) => { $('story-new-desc-val').textContent = e.target.value; });
    $('story-new-prose').addEventListener('input', (e) => { $('story-new-prose-val').textContent = e.target.value; });
    $('story-new-seg').addEventListener('change', () => _updateNewHints());
    $('story-new-choicefreq').addEventListener('change', () => _updateNewHints());
    $('story-new-nsfw').addEventListener('change', () => _updateNewHints());

    // Settings overlay
    $('story-btn-set-save').addEventListener('click', _saveSettings);
    $('story-btn-set-cancel').addEventListener('click', () => _showOverlay('story-overlay-settings', false));
    $('story-set-desc').addEventListener('input', (e) => { $('story-set-desc-val').textContent = e.target.value; });
    $('story-set-prose').addEventListener('input', (e) => { $('story-set-prose-val').textContent = e.target.value; });
    $('story-set-seg').addEventListener('change', () => _updateSettingsHints());
    $('story-set-choicefreq').addEventListener('change', () => _updateSettingsHints());
    $('story-set-nsfw').addEventListener('change', () => _updateSettingsHints());

    // Ask Storyteller
    $('story-btn-ask-send').addEventListener('click', _sendAsk);
    $('story-btn-ask-clear').addEventListener('click', _clearAsk);
    $('story-btn-ask-close').addEventListener('click', () => _showOverlay('story-overlay-ask', false));
    $('story-ask-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendAsk();
      }
    });

    // Nudge
    $('story-btn-nudge-apply').addEventListener('click', _applyNudge);
    $('story-btn-nudge-clear').addEventListener('click', _clearNudge);
    $('story-btn-nudge-close').addEventListener('click', () => _showOverlay('story-overlay-nudge', false));

    // Companion chat
    $('story-btn-comp-send').addEventListener('click', _sendCompanion);
    $('story-btn-comp-clear').addEventListener('click', _clearCompanion);
    $('story-btn-comp-close').addEventListener('click', () => _showOverlay('story-overlay-companion', false));
    $('story-comp-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendCompanion();
      }
    });
  }

  // ── Mode toggle ──────────────────────────────────────────────────────
  async function toggle() {
    if (!_initialized) init();
    if (document.body.classList.contains('story-mode')) {
      _exit();
    } else {
      await _enter();
    }
  }

  async function _enter() {
    document.body.classList.add('story-mode');
    if (!_catalogs) {
      try { _catalogs = await window.storyAPI.catalogs(); }
      catch (e) { console.warn('[TextStory] catalogs load failed:', e); }
    }
    // Subscribe to updates
    if (_updateOff) { try { _updateOff(); } catch {} }
    _updateOff = window.storyAPI.onUpdate(_handleUpdate);

    // Show library first — user picks or starts new.
    _openLibrary();
  }

  function _exit() {
    document.body.classList.remove('story-mode');
    if (_updateOff) { try { _updateOff(); } catch {} _updateOff = null; }
    // Close any open overlays
    document.querySelectorAll('#text-story .story-overlay').forEach((el) => el.classList.add('hidden'));
    _currentSlug = null;
    _state = null;
    _log = [];
  }

  // ── Library overlay ──────────────────────────────────────────────────
  async function _openLibrary() {
    _showOverlay('story-overlay-library', true);
    const res = await window.storyAPI.list();
    const stories = (res && res.stories) || [];
    const list = $('story-library-list');
    if (stories.length === 0) {
      list.innerHTML = `<div class="story-library-empty">No stories yet. Create your first one below.</div>`;
      return;
    }
    list.innerHTML = stories.map((s) => {
      const updated = s.updated ? new Date(s.updated).toLocaleString() : '';
      const type = s.storyTypeLabel || s.storyType || '';
      const mc = s.mainCharacter && s.mainCharacter.name ? ` · ${_esc(s.mainCharacter.name)}` : '';
      return `
        <div class="story-library-row" data-slug="${_esc(s.slug)}">
          <div class="story-library-row-main">
            <div class="story-library-row-title">${_esc(s.title || s.slug)}</div>
            <div class="story-library-row-meta">${_esc(type)} · Turn ${s.turnCount || 0}${mc} · <span class="story-library-row-updated">${_esc(updated)}</span></div>
          </div>
          <div class="story-library-row-actions">
            <button class="story-btn story-btn-primary story-btn-small" data-act="open">OPEN</button>
            <button class="story-btn story-btn-small story-btn-danger" data-act="delete" title="Delete this story forever">DEL</button>
          </div>
        </div>
      `;
    }).join('');
    // Wire row actions
    list.querySelectorAll('.story-library-row').forEach((row) => {
      const slug = row.getAttribute('data-slug');
      row.querySelector('[data-act="open"]').addEventListener('click', () => _openStory(slug));
      row.querySelector('[data-act="delete"]').addEventListener('click', () => _deleteStory(slug, row));
    });
  }

  async function _openStory(slug) {
    const res = await window.storyAPI.get(slug);
    if (!res || !res.success) {
      alert(res && res.error ? res.error : 'Failed to open story.');
      return;
    }
    _currentSlug = slug;
    _state = res.state;
    _log = res.log || [];
    // Load ancillary data
    try {
      const [rx, bm, pt] = await Promise.all([
        window.storyAPI.reactions(_currentSlug),
        window.storyAPI.bookmarks(_currentSlug),
        window.storyAPI.listPortraits(_currentSlug),
      ]);
      _reactions = (rx && rx.reactions) || [];
      _bookmarks = (bm && bm.bookmarks) || [];
      _portraits = (pt && pt.portraits) || {};
    } catch (e) { console.warn('[TextStory] load ancillary failed:', e); }
    _showOverlay('story-overlay-library', false);
    _refreshHeader();
    _refreshScroll();
    _refreshChoices();
    _refreshReactionsPanel();

    // Recovery: story exists but never got its blueprint (e.g. app crashed
    // during initial generation). Offer to finish setup now.
    if (!_state.storyBlueprint && (_state.turnCount || 0) === 0) {
      _showBusy('The Storyteller is designing your story… (recovering from an incomplete setup)');
      const bp = await window.storyAPI.generateBlueprint(_currentSlug);
      if (bp && bp.success) {
        _state = bp.state;
        _refreshHeader();
        _showBusy('The Storyteller is composing the opening scene…');
        await _takeTurn({ kind: 'continue', input: '' });
      }
      _hideBusy();
      return;
    }

    // NOTE: We intentionally do NOT auto-fire details generation here.
    // Deep character + chapter details are large calls that can take 3–10
    // minutes and sometimes hit the timeout. Silently retrying every open
    // wastes time. If details are missing, the CHARACTERS + CHAPTERS
    // inspector tabs show an explicit "GENERATE DETAILS" button so the
    // user decides when to spend the time on it.
  }

  async function _deleteStory(slug, rowEl) {
    const confirmed = await window.storyAPI.confirm(
      'Delete this story?',
      'This will permanently remove all files for this story. This cannot be undone.',
      'Delete Forever',
      'Cancel',
    );
    if (!confirmed) return;
    await window.storyAPI.delete(slug);
    // Refresh
    _openLibrary();
  }

  // ── New story wizard ─────────────────────────────────────────────────
  function _openNewStoryWizard() {
    if (!_catalogs) {
      alert('Story catalogs failed to load. Try again in a moment.');
      return;
    }
    _populateNewWizardControls();
    _showOverlay('story-overlay-library', false);
    _showOverlay('story-overlay-new', true);
    setTimeout(() => $('story-new-title').focus(), 50);
  }

  function _populateNewWizardControls() {
    // Story-type grid
    const typeGrid = $('story-new-type-grid');
    typeGrid.innerHTML = _catalogs.storyTypes.map((t) => `
      <label class="story-type-card" data-slug="${_esc(t.slug)}">
        <input type="radio" name="story-new-type" value="${_esc(t.slug)}" />
        <div class="story-type-card-inner">
          <div class="story-type-card-label">${_esc(t.label)}</div>
          <div class="story-type-card-hint">${_esc(t.hint)}</div>
        </div>
      </label>
    `).join('');
    // Default to 'custom'
    const def = typeGrid.querySelector('input[value="custom"]');
    if (def) def.checked = true;

    // Story-length grid (STORY_GUIDELINES_PATCH §3.3.2)
    const lengthGrid = $('story-new-length-grid');
    if (lengthGrid && Array.isArray(_catalogs.storyLengths)) {
      lengthGrid.innerHTML = _catalogs.storyLengths.map((l) => `
        <label class="story-type-card" data-slug="${_esc(l.slug)}">
          <input type="radio" name="story-new-length" value="${_esc(l.slug)}" />
          <div class="story-type-card-inner">
            <div class="story-type-card-label">${_esc(l.label)}</div>
            <div class="story-type-card-hint">${_esc(l.hint)}</div>
          </div>
        </label>
      `).join('');
      const lenDef = lengthGrid.querySelector('input[value="novel"]');
      if (lenDef) lenDef.checked = true;
    }

    // Segment length
    _fillSelect('story-new-seg', _catalogs.segmentLengths, _catalogs.defaults.segmentLength);
    // Choice frequency
    _fillSelect('story-new-choicefreq', _catalogs.choiceFrequencies, _catalogs.defaults.choiceFrequency);
    // NSFW
    _fillSelect('story-new-nsfw', _catalogs.nsfwLevels, _catalogs.defaults.nsfwLevel);

    // Sliders default
    $('story-new-desc').value  = _catalogs.defaults.descriptiveness || 3;
    $('story-new-desc-val').textContent  = $('story-new-desc').value;
    $('story-new-prose').value = _catalogs.defaults.proseStyle      || 3;
    $('story-new-prose-val').textContent = $('story-new-prose').value;

    _updateNewHints();
  }

  function _updateNewHints() {
    const seg  = _catalogs.segmentLengths.find((s) => s.slug === $('story-new-seg').value);
    const cf   = _catalogs.choiceFrequencies.find((s) => s.slug === $('story-new-choicefreq').value);
    const nsfw = _catalogs.nsfwLevels.find((s) => s.slug === $('story-new-nsfw').value);
    $('story-new-seg-hint').textContent        = seg  ? `${seg.range} · ${seg.hint}` : '';
    $('story-new-choicefreq-hint').textContent = cf   ? cf.hint   : '';
    $('story-new-nsfw-hint').textContent       = nsfw ? nsfw.hint : '';
  }

  function _updateSettingsHints() {
    const seg  = _catalogs.segmentLengths.find((s) => s.slug === $('story-set-seg').value);
    const cf   = _catalogs.choiceFrequencies.find((s) => s.slug === $('story-set-choicefreq').value);
    const nsfw = _catalogs.nsfwLevels.find((s) => s.slug === $('story-set-nsfw').value);
    $('story-set-seg-hint').textContent        = seg  ? `${seg.range} · ${seg.hint}` : '';
    $('story-set-choicefreq-hint').textContent = cf   ? cf.hint   : '';
    $('story-set-nsfw-hint').textContent       = nsfw ? nsfw.hint : '';
  }

  function _fillSelect(id, items, defaultSlug) {
    const el = $(id);
    el.innerHTML = items.map((it) => `<option value="${_esc(it.slug)}">${_esc(it.label)}</option>`).join('');
    if (defaultSlug) el.value = defaultSlug;
  }

  async function _createNewStory() {
    // Title is optional — the Storyteller will invent one if blank.
    const title = $('story-new-title').value.trim();

    const typeInput = document.querySelector('input[name="story-new-type"]:checked');
    const typeSlug = typeInput ? typeInput.value : 'custom';
    const typeObj  = _catalogs.storyTypes.find((t) => t.slug === typeSlug) || _catalogs.storyTypes[_catalogs.storyTypes.length - 1];
    // STORY LENGTH — user-picked target section count. Default = novel.
    const lengthInput = document.querySelector('input[name="story-new-length"]:checked');
    const storyLength = lengthInput ? lengthInput.value : 'novel';

    const settings = {
      segmentLength:    $('story-new-seg').value,
      choiceFrequency:  $('story-new-choicefreq').value,
      descriptiveness:  parseInt($('story-new-desc').value, 10)  || 3,
      proseStyle:       parseInt($('story-new-prose').value, 10) || 3,
      nsfwLevel:        $('story-new-nsfw').value,
    };
    const mainCharacter = {
      name:   $('story-new-mc-name').value.trim(),
      gender: $('story-new-mc-gender').value.trim(),
    };
    const startingContext = $('story-new-context').value.trim();

    _showOverlay('story-overlay-new', false);
    _showBusy('Creating story…');

    const res = await window.storyAPI.create({
      title, storyType: typeSlug, storyTypeLabel: typeObj.label,
      startingContext, mainCharacter, settings, storyLength,
    });
    if (!res || !res.success) {
      _hideBusy();
      alert(res && res.error ? res.error : 'Failed to create story.');
      _openLibrary();
      return;
    }
    _currentSlug = res.slug;
    _state = res.state;
    _log = res.log || [];
    _refreshHeader();
    _refreshScroll();
    _refreshChoices();

    // Multi-stage setup chain (STORY_GUIDELINES_PATCH §4).
    // Each stage is a discrete Claude call so no single call is at
    // timeout risk. On any failure, the user can re-enter the story
    // and hit REGEN PLAN to resume from where it stopped.
    const ok = await _runSetupChain({
      includeBlueprint: true,
      includeOpening:   true,
    });
    _hideBusy();
    if (!ok) return;
  }

  // Chain runner: called at initial creation AND by the REGEN PLAN button.
  // Progressively fills the blueprint's pacing structure. Skips stages that
  // are already populated (idempotent). Returns true on success.
  async function _runSetupChain({ includeBlueprint = false, includeOpening = false } = {}) {
    if (!_currentSlug) return false;
    const refresh = (msg) => _showBusy(msg);

    // Stage 1: Blueprint
    if (includeBlueprint && (!_state.storyBlueprint || !_state.storyBlueprint.plotSummary)) {
      refresh('The Storyteller is designing your story… (plot, characters, arc)');
      const bp = await window.storyAPI.generateBlueprint(_currentSlug);
      if (!bp || !bp.success) {
        const err = bp && bp.error ? bp.error : 'Blueprint generation failed.';
        _appendErrorEntry(err, bp && bp.rawPreview);
        alert('The Storyteller failed to design the story blueprint. Re-open the story and retry from the inspector.');
        return false;
      }
      _state = bp.state;
      _refreshHeader();
    }

    // Stage 2: Story Overview
    if (!_state.storyBlueprint || !_state.storyBlueprint.storyOverview) {
      refresh('Writing the STORY OVERVIEW — the core the Storyteller must know cold…');
      const ov = await window.storyAPI.generateStoryOverview(_currentSlug);
      if (!ov || !ov.success) {
        console.warn('[Story] story-overview stage failed:', ov && ov.error);
        _appendErrorEntry('Story-overview stage failed: ' + (ov && ov.error), ov && ov.rawPreview);
      } else {
        _state = ov.state;
      }
    }

    // Stage 3: Chapter Skeleton (all chapters)
    if (!_state.storyBlueprint || !Array.isArray(_state.storyBlueprint.chapterSummaries) || _state.storyBlueprint.chapterSummaries.length === 0) {
      refresh('Sketching each chapter — kickoff, driver, closer, section budget…');
      const cs = await window.storyAPI.generateChapterSkeleton(_currentSlug);
      if (!cs || !cs.success) {
        console.warn('[Story] chapter-skeleton stage failed:', cs && cs.error);
        _appendErrorEntry('Chapter-skeleton stage failed: ' + (cs && cs.error), cs && cs.rawPreview);
      } else {
        _state = cs.state;
      }
    }

    // Stage 5: Event Skeleton — one call per chapter
    const bp = _state.storyBlueprint || {};
    const chapterList = (bp.chapters && Array.isArray(bp.chapters.list)) ? bp.chapters.list : [];
    for (let i = 0; i < chapterList.length; i++) {
      const ch = chapterList[i];
      const alreadyHasEvents = Array.isArray(bp.events) && bp.events.some((e) => (e.chapterNumber || 0) === ch.number);
      if (alreadyHasEvents) continue;
      refresh(`Breaking chapter ${ch.number} of ${chapterList.length} into events…`);
      const es = await window.storyAPI.generateEventSkeleton(_currentSlug, ch.number);
      if (!es || !es.success) {
        console.warn(`[Story] event-skeleton chapter ${ch.number} failed:`, es && es.error);
      } else {
        _state = es.state;
      }
    }

    // Stage 6: Event Summaries — batched (2 per call)
    const allEvents = (_state.storyBlueprint && Array.isArray(_state.storyBlueprint.events)) ? _state.storyBlueprint.events : [];
    const summarized = new Set((_state.storyBlueprint && Array.isArray(_state.storyBlueprint.eventSummaries)) ? _state.storyBlueprint.eventSummaries.map((s) => s.id) : []);
    const needSummary = allEvents.map((e) => e.id).filter((id) => !summarized.has(id));
    for (let i = 0; i < needSummary.length; i += 2) {
      const batch = needSummary.slice(i, i + 2);
      refresh(`Writing event summaries — batch ${Math.floor(i / 2) + 1} of ${Math.ceil(needSummary.length / 2)}…`);
      const es = await window.storyAPI.generateEventSummaries(_currentSlug, batch);
      if (!es || !es.success) {
        console.warn('[Story] event-summaries batch failed:', es && es.error);
      } else {
        _state = es.state;
      }
    }
    _refreshHeader();

    // Stage 7: Opening scene (only on brand-new stories)
    if (includeOpening && (!Array.isArray(_log) || _log.length === 0)) {
      refresh('The Storyteller is composing the opening scene…');
      await _takeTurn({ kind: 'continue', input: '' });
    }
    return true;
  }

  // ── Settings overlay ─────────────────────────────────────────────────
  function _openSettings() {
    if (!_state || !_catalogs) return;
    _fillSelect('story-set-seg',        _catalogs.segmentLengths,    _state.settings.segmentLength);
    _fillSelect('story-set-choicefreq', _catalogs.choiceFrequencies, _state.settings.choiceFrequency);
    _fillSelect('story-set-nsfw',       _catalogs.nsfwLevels,        _state.settings.nsfwLevel);
    $('story-set-desc').value  = _state.settings.descriptiveness || 3;
    $('story-set-desc-val').textContent  = $('story-set-desc').value;
    $('story-set-prose').value = _state.settings.proseStyle || 3;
    $('story-set-prose-val').textContent = $('story-set-prose').value;
    _updateSettingsHints();
    _showOverlay('story-overlay-settings', true);
  }

  async function _saveSettings() {
    if (!_state || !_currentSlug) return;
    const settings = {
      segmentLength:    $('story-set-seg').value,
      choiceFrequency:  $('story-set-choicefreq').value,
      descriptiveness:  parseInt($('story-set-desc').value, 10)  || 3,
      proseStyle:       parseInt($('story-set-prose').value, 10) || 3,
      nsfwLevel:        $('story-set-nsfw').value,
    };
    const res = await window.storyAPI.updateSettings(_currentSlug, settings);
    if (res && res.success) {
      _state = res.state;
      _refreshHeader();
    }
    _showOverlay('story-overlay-settings', false);
  }

  // ── Ask Storyteller overlay ──────────────────────────────────────────
  async function _openAsk() {
    if (!_currentSlug) return;
    _showOverlay('story-overlay-ask', true);
    const res = await window.storyAPI.askHistory(_currentSlug);
    _askHistory = (res && res.history) || [];
    _refreshAskScroll();
    setTimeout(() => $('story-ask-input').focus(), 50);
  }

  async function _sendAsk() {
    if (_askBusy) return;
    if (!_currentSlug) return;
    const msg = $('story-ask-input').value.trim();
    if (!msg) return;
    _askHistory.push({ role: 'user', content: msg });
    _refreshAskScroll();
    $('story-ask-input').value = '';
    _askBusy = true;
    _refreshAskScroll(true); // append a placeholder
    const res = await window.storyAPI.ask(_currentSlug, msg);
    _askBusy = false;
    if (res && res.success) {
      _askHistory.push({ role: 'storyteller', content: res.reply, stateChanged: !!res.stateChanged });
      if (res.stateChanged && res.state) {
        _state = res.state;
        _refreshHeader();
        // Also refresh the story scroll — a "correction" entry was appended
        try { const g = await window.storyAPI.get(_currentSlug); if (g && g.success) _log = g.log; } catch {}
        _refreshScroll();
      }
    } else {
      _askHistory.push({ role: 'storyteller', content: '(Error: ' + (res && res.error ? res.error : 'unknown') + ')' });
    }
    _refreshAskScroll();
  }

  async function _clearAsk() {
    if (!_currentSlug) return;
    const ok = await window.storyAPI.confirm(
      'Clear Ask-Storyteller chat?',
      'This wipes the private meta-chat transcript. Story state is NOT affected.',
      'Clear',
      'Cancel',
    );
    if (!ok) return;
    await window.storyAPI.askClear(_currentSlug);
    _askHistory = [];
    _refreshAskScroll();
  }

  // ── Nudge overlay ────────────────────────────────────────────────────
  function _openNudge() {
    if (!_currentSlug) return;
    _showOverlay('story-overlay-nudge', true);
    // If a nudge is already queued, show it
    const currentBody = $('story-nudge-current-body');
    const currentBox  = $('story-nudge-current');
    if (_state && typeof _state.pendingNudge === 'string' && _state.pendingNudge.trim()) {
      currentBody.textContent = _state.pendingNudge;
      currentBox.classList.remove('hidden');
    } else {
      currentBox.classList.add('hidden');
    }
    $('story-nudge-input').value = '';
    setTimeout(() => $('story-nudge-input').focus(), 50);
  }

  async function _applyNudge() {
    if (!_currentSlug) return;
    const text = $('story-nudge-input').value.trim();
    if (!text) return;
    const res = await window.storyAPI.setNudge(_currentSlug, text);
    if (res && res.success) {
      _state = res.state;
      _refreshNudgeIndicator();
    }
    _showOverlay('story-overlay-nudge', false);
  }

  async function _clearNudge() {
    if (!_currentSlug) return;
    const res = await window.storyAPI.setNudge(_currentSlug, null);
    if (res && res.success) {
      _state = res.state;
      _refreshNudgeIndicator();
    }
    _showOverlay('story-overlay-nudge', false);
  }

  function _refreshNudgeIndicator() {
    const btn = $('story-btn-nudge');
    if (!btn) return;
    const active = !!(_state && typeof _state.pendingNudge === 'string' && _state.pendingNudge.trim());
    btn.classList.toggle('story-btn-active', active);
    btn.title = active
      ? 'Nudge queued: ' + _state.pendingNudge.slice(0, 120) + (_state.pendingNudge.length > 120 ? '…' : '')
      : 'Steer the story with a note for the Storyteller (respected on the next turn)';
  }

  // ── Companion chat overlay ──────────────────────────────────────────
  async function _openCompanion() {
    if (!_currentSlug) return;
    _showOverlay('story-overlay-companion', true);
    const res = await window.storyAPI.companionChatHistory(_currentSlug);
    _compHistory = (res && res.history) || [];
    _refreshCompScroll();
    setTimeout(() => $('story-comp-input').focus(), 50);
  }

  async function _sendCompanion() {
    if (_compBusy || !_currentSlug) return;
    const msg = $('story-comp-input').value.trim();
    if (!msg) return;
    _compHistory.push({ role: 'user', content: msg });
    $('story-comp-input').value = '';
    _compBusy = true;
    _refreshCompScroll(true);
    const res = await window.storyAPI.companionChat(_currentSlug, msg);
    _compBusy = false;
    if (res && res.success) {
      _compHistory.push({
        role:     'companion',
        content:  (res.reply && res.reply.dialogue) || '',
        thoughts: (res.reply && res.reply.thoughts) || '',
        emotion:  (res.reply && res.reply.emotion)  || 'neutral',
      });
    } else {
      _compHistory.push({ role: 'companion', content: '(Error: ' + (res && res.error ? res.error : 'unknown') + ')' });
    }
    _refreshCompScroll();
  }

  async function _clearCompanion() {
    if (!_currentSlug) return;
    const ok = await window.storyAPI.confirm(
      'Clear companion chat about this story?',
      'This wipes the transcript of your out-of-story chat about this specific story. Aria\'s permanent memories are not affected.',
      'Clear',
      'Cancel',
    );
    if (!ok) return;
    await window.storyAPI.companionChatClear(_currentSlug);
    _compHistory = [];
    _refreshCompScroll();
  }

  function _refreshCompScroll(withPending = false) {
    const scroll = $('story-comp-scroll');
    if (!scroll) return;
    const html = _compHistory.map((m) => {
      const isUser = m.role === 'user';
      const who = isUser ? 'YOU' : 'ARIA';
      const cls = isUser ? 'story-ask-msg-user' : 'story-ask-msg-comp';
      const emotion = m.emotion && !isUser ? `<span class="story-comp-emotion">(${_esc(m.emotion)})</span>` : '';
      const thoughts = m.thoughts && !isUser
        ? `<div class="story-comp-thoughts">${_esc(m.thoughts)}</div>`
        : '';
      return `<div class="story-ask-msg ${cls}">
        <div class="story-ask-msg-who">${who} ${emotion}</div>
        <div class="story-ask-msg-body">${_esc(m.content || '')}</div>
        ${thoughts}
      </div>`;
    }).join('');
    scroll.innerHTML = html + (withPending
      ? `<div class="story-ask-msg story-ask-msg-comp"><div class="story-ask-msg-who">ARIA</div><div class="story-ask-msg-body story-ask-msg-pending">…</div></div>`
      : '');
    scroll.scrollTop = scroll.scrollHeight;
  }

  function _refreshAskScroll(withPending = false) {
    const scroll = $('story-ask-scroll');
    const html = _askHistory.map((m) => {
      const who = m.role === 'user' ? 'YOU' : 'STORYTELLER';
      const cls = m.role === 'user' ? 'story-ask-msg-user' : 'story-ask-msg-st';
      const badge = m.stateChanged ? '<span class="story-ask-badge">✎ CORRECTION APPLIED</span>' : '';
      return `<div class="story-ask-msg ${cls}">
        <div class="story-ask-msg-who">${who}${badge}</div>
        <div class="story-ask-msg-body">${_esc(m.content || '')}</div>
      </div>`;
    }).join('');
    scroll.innerHTML = html + (withPending
      ? `<div class="story-ask-msg story-ask-msg-st"><div class="story-ask-msg-who">STORYTELLER</div><div class="story-ask-msg-body story-ask-msg-pending">…</div></div>`
      : '');
    scroll.scrollTop = scroll.scrollHeight;
  }

  // ── Turn actions ─────────────────────────────────────────────────────
  async function _sendFreeform() {
    if (_busy || !_currentSlug) return;
    const text = $('story-input').value.trim();
    if (!text) return;
    $('story-input').value = '';
    await _takeTurn({ kind: 'freeform', input: text });
  }

  async function _sendContinue() {
    if (_busy || !_currentSlug) return;
    await _takeTurn({ kind: 'continue', input: '' });
  }

  async function _sendChoice(choice, idx) {
    if (_busy || !_currentSlug) return;
    await _takeTurn({ kind: 'choice', input: choice, idx });
  }

  async function _takeTurn(opts) {
    _busy = true;
    _showBusy('The Storyteller is writing…');
    // Optimistic append of player action to the scroll so they SEE the turn happening
    _appendOptimistic(opts);
    try {
      const res = await window.storyAPI.takeTurn({ slug: _currentSlug, ...opts });
      _hideBusy();
      _busy = false;
      if (!res || !res.success) {
        const msg = res && res.error ? res.error : 'Unknown error.';
        _appendErrorEntry(msg, res && res.rawPreview);
        // Reload log to remove the optimistic user action (server-side we
        // still logged it though — we could offer RETRY here).
        if (res && res.state) _state = res.state;
        if (res && res.log)   _log   = res.log;
        _refreshHeader();
        _refreshScroll();
        return;
      }
      // Server state is authoritative
      _state = res.state;
      _log   = res.log || _log;
      _refreshHeader();
      _refreshScroll();
      _refreshChoices();
      // Fire companion reaction in the background (light call, doesn't block)
      _fireReaction();
    } catch (e) {
      _hideBusy();
      _busy = false;
      _appendErrorEntry(String(e && e.message || e));
    }
  }

  async function _retryTurn() {
    if (_busy || !_currentSlug) return;
    const ok = await window.storyAPI.confirm(
      'Undo the last turn?',
      'This removes the last narrator segment AND your last action from the log so you can try something different.',
      'Undo Last Turn',
      'Cancel',
    );
    if (!ok) return;
    const res = await window.storyAPI.retryTurn(_currentSlug);
    if (res && res.success) {
      _state = res.state;
      _log   = res.log || _log;
      _refreshHeader();
      _refreshScroll();
      _refreshChoices();
    }
  }

  // ── Update event from main ───────────────────────────────────────────
  function _handleUpdate(payload) {
    // Any turn-completion or ask-side state mutation lands here — but we
    // already refresh directly after our own IPC calls, so this is really
    // just for ask-side pushes (correction applied). Guard: only act if
    // the slug matches (right now the payload doesn't carry slug — we
    // treat it as authoritative since only one story is open at a time).
    if (!payload) return;
    if (payload.state) _state = payload.state;
    if (payload.log)   _log   = payload.log;
    _refreshHeader();
    _refreshScroll();
    _refreshChoices();
  }

  // ── Rendering: header + sidebar cards ────────────────────────────────
  function _refreshHeader() {
    if (!_state) return;
    $('story-header-title').textContent   = _state.title || '—';
    $('story-header-section').textContent = `Section ${_state.turnCount || 0}`;
    const sc = _state.scene || {};
    // Explicit "Scene:" prefix so the scene name doesn't visually blur into
    // the chapter number that precedes it in the header row.
    $('story-header-scene').textContent   = sc.name ? `Scene: ${sc.name}` : '—';

    // Chapter display (from blueprint if present)
    const bp = _state.storyBlueprint;
    const chBox   = $('story-header-chapter');
    const sideNum = $('story-sidebar-chapter-num');
    const sideTtl = $('story-sidebar-chapter-title');
    const sideSN  = $('story-sidebar-scene-name');
    const sideSL  = $('story-sidebar-scene-loc');
    if (bp && bp.chapters && Array.isArray(bp.chapters.list) && bp.chapters.list.length) {
      const cur = Math.max(1, Math.min(bp.chapters.total || bp.chapters.list.length, bp.chapters.currentChapter || 1));
      const total = bp.chapters.total || bp.chapters.list.length;
      const chapterObj = bp.chapters.list[cur - 1] || null;
      chBox.textContent   = `Chapter ${cur}/${total}`;
      sideNum.textContent = `${cur} of ${total}`;
      sideTtl.textContent = chapterObj && chapterObj.title ? chapterObj.title : '—';
    } else {
      chBox.textContent   = 'Chapter —';
      sideNum.textContent = '—';
      sideTtl.textContent = '—';
    }
    sideSN.textContent = sc.name || '—';
    sideSL.textContent = [sc.location, sc.time].filter(Boolean).join(' · ');

    _refreshSceneCharacters();
    _refreshNudgeIndicator();
    _refreshPacingCard();
  }

  // ── Sidebar: PACING card (STORY_GUIDELINES_PATCH §7.1) ─────────────────
  // Shows current chapter budget, current event budget, and colour-codes
  // based on remaining sections. Hidden if the story has no blueprint yet.
  function _refreshPacingCard() {
    const card = $('story-pacing-card');
    const body = $('story-pacing-body');
    if (!card || !body || !_state) return;
    const bp = _state.storyBlueprint;
    if (!bp || !bp.chapters || !Array.isArray(bp.chapters.list)) { card.classList.add('hidden'); return; }
    const cur = bp.chapters.currentChapter || 1;
    const chObj = bp.chapters.list.find((c) => c.number === cur);
    if (!chObj) { card.classList.add('hidden'); return; }
    const chBudget = typeof chObj.sectionBudget === 'number' ? chObj.sectionBudget : 3;
    const chUsed   = typeof chObj.sectionsUsed  === 'number' ? chObj.sectionsUsed  : 0;
    const chRem    = chBudget - chUsed;
    const active   = Array.isArray(bp.events) ? bp.events.find((e) => e.status === 'active') : null;

    // Colour class based on the tightest remaining budget
    card.classList.remove('story-pacing-warn', 'story-pacing-over');
    const chRemHtml = _pacingBar(chUsed, chBudget);
    let bodyHtml = `
      <div class="story-pacing-row">
        <div class="story-pacing-row-label">Chapter ${cur}</div>
        <div class="story-pacing-row-values">${chUsed}/${chBudget}</div>
      </div>
      ${chRemHtml}
    `;
    if (active) {
      const evBudget = typeof active.sectionBudget === 'number' ? active.sectionBudget : 2;
      const evUsed   = typeof active.sectionsUsed  === 'number' ? active.sectionsUsed  : 0;
      const evRem    = evBudget - evUsed;
      const evLabel  = active.title || active.id;
      bodyHtml += `
        <div class="story-pacing-row story-pacing-row-event">
          <div class="story-pacing-row-label" title="${_esc(evLabel)}">${_esc(_truncate(evLabel, 28))}</div>
          <div class="story-pacing-row-values">${evUsed}/${evBudget}</div>
        </div>
        ${_pacingBar(evUsed, evBudget)}
      `;
      if (evRem <= 0) card.classList.add('story-pacing-over');
      else if (evRem === 1) card.classList.add('story-pacing-warn');
    } else if (chRem <= 0) card.classList.add('story-pacing-over');
    else if (chRem === 1) card.classList.add('story-pacing-warn');

    body.innerHTML = bodyHtml;
    card.classList.remove('hidden');
  }

  function _pacingBar(used, budget) {
    const denom = Math.max(1, budget);
    const pct   = Math.max(0, Math.min(100, Math.round((used / denom) * 100)));
    const over  = used > budget ? Math.round(((used - budget) / denom) * 100) : 0;
    return `<div class="story-pacing-bar">
      <div class="story-pacing-bar-fill" style="width:${pct}%"></div>
      ${over > 0 ? `<div class="story-pacing-bar-over" style="width:${Math.min(100, over)}%"></div>` : ''}
    </div>`;
  }

  function _truncate(s, n) {
    const str = String(s || '');
    return str.length <= n ? str : (str.slice(0, n - 1) + '…');
  }

  // ── Sidebar: SCENE CHARACTERS card ──────────────────────────────────
  // Shows a 1:1 portrait icon + name for every character believed to be
  // in the current scene. Source = current chapter's charactersInvolved
  // list (from chapterDetails), resolved to display names via the
  // blueprint's character rosters. Portraits come from _portraits
  // (uploaded PNG/JPG/WebP per character). Missing portraits show a
  // small blank placeholder tile.
  function _refreshSceneCharacters() {
    const card = $('story-scene-chars-card');
    const list = $('story-scene-chars-list');
    if (!card || !list) return;
    // Priority order for "who is in this scene right now":
    //   1. state.scene.characters — populated by the Storyteller per turn
    //      (see rule 16). Most accurate.
    //   2. chapterDetails[currentChapter].charactersInvolved — the chapter's
    //      whole cast. Less accurate but useful as a fallback for existing
    //      stories that predate the per-turn scene.characters field.
    const bp = _state && _state.storyBlueprint;
    const sceneChars = (_state && _state.scene && Array.isArray(_state.scene.characters)) ? _state.scene.characters : [];
    let ids = sceneChars;
    if (!ids.length && bp) {
      const cur = (bp.chapters && bp.chapters.currentChapter) || null;
      const chapterDetails = Array.isArray(bp.chapterDetails) ? bp.chapterDetails : [];
      const chObj = cur ? chapterDetails.find((c) => c.number === cur) : null;
      ids = (chObj && Array.isArray(chObj.charactersInvolved)) ? chObj.charactersInvolved : [];
    }
    if (!ids.length) { card.classList.add('hidden'); return; }

    // Build a lookup: id → display name. Sources checked in order:
    //   1. main character (id "main_character")
    //   2. keyCharacters + sideCharacters
    //   3. characterDetails (fallback if the roster changed)
    //   4. memory.characters (established-during-play list)
    const nameById = new Map();
    const mc = _state.mainCharacter || {};
    if (mc && mc.name) nameById.set('main_character', mc.name);
    for (const c of (bp.keyCharacters  || [])) if (c && c.id) nameById.set(c.id, c.name || c.id);
    for (const c of (bp.sideCharacters || [])) if (c && c.id) nameById.set(c.id, c.name || c.id);
    for (const c of (bp.characterDetails || [])) if (c && c.id && !nameById.has(c.id)) nameById.set(c.id, c.name || c.id);
    for (const c of ((_state.memory && _state.memory.characters) || [])) if (c && c.id && !nameById.has(c.id)) nameById.set(c.id, c.name || c.id);

    card.classList.remove('hidden');
    list.innerHTML = ids.map((id) => {
      const name = nameById.get(id) || id;
      const portraitPath = _portraits[id];
      const portraitUrl  = portraitPath ? 'file://' + portraitPath.replace(/\\/g, '/') : null;
      const portrait = portraitUrl
        ? `<img class="story-scene-char-portrait" src="${_esc(portraitUrl)}" alt="" />`
        : `<div class="story-scene-char-portrait story-scene-char-portrait-blank story-portrait-clickable" data-blank-portrait="${_esc(id)}" title="Copy icon AI prompt + upload portrait"></div>`;
      return `<div class="story-scene-char-row">${portrait}<div class="story-scene-char-name">${_esc(name)}</div></div>`;
    }).join('');
    // Wire blank-portrait clicks in the sidebar (inspector wires its own).
    list.querySelectorAll('[data-blank-portrait]').forEach((el) => {
      el.addEventListener('click', () => _handleBlankPortraitClick(el.getAttribute('data-blank-portrait')));
    });
  }

  // ── Sidebar info popups (Story So Far / Characters / Places / Events) ─
  async function _openInfo(kind) {
    if (!_state) return;
    let title = '';
    let bodyHtml = '';
    if (kind === 'summary') {
      title = '📜 STORY SO FAR';
      const summary = (_state.memory && _state.memory.storySummary) ? _state.memory.storySummary : '';
      bodyHtml = summary
        ? `<div class="story-info-summary">${_esc(summary).replace(/\n\n+/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}</div>`
        : `<div class="story-info-empty">The story hasn\'t built a summary yet — this fills in as the plot develops.</div>`;
    } else if (kind === 'characters') {
      title = '👥 CHARACTERS';
      const chars = (_state.memory && _state.memory.characters) || [];
      if (!chars.length) {
        bodyHtml = `<div class="story-info-empty">No characters established yet.</div>`;
      } else {
        bodyHtml = chars.map((c) => `
          <div class="story-info-character">
            <div class="story-info-character-name">${_esc(c.name || '(unnamed)')}
              ${c.role ? `<span class="story-info-character-role">${_esc(c.role)}</span>` : ''}
            </div>
            ${c.description ? `<div class="story-info-character-line"><span>Description</span> ${_esc(c.description)}</div>` : ''}
            ${c.appearance  ? `<div class="story-info-character-line"><span>Appearance</span> ${_esc(c.appearance)}</div>` : ''}
            ${c.personality ? `<div class="story-info-character-line"><span>Personality</span> ${_esc(c.personality)}</div>` : ''}
            ${c.relationships ? `<div class="story-info-character-line"><span>Relationships</span> ${_esc(Array.isArray(c.relationships) ? c.relationships.join(', ') : c.relationships)}</div>` : ''}
            ${c.notes       ? `<div class="story-info-character-line"><span>Notes</span> ${_esc(c.notes)}</div>` : ''}
          </div>
        `).join('');
      }
    } else if (kind === 'locations') {
      title = '🗺 PLACES';
      const locs = (_state.memory && _state.memory.locations) || [];
      if (!locs.length) {
        bodyHtml = `<div class="story-info-empty">No places established yet.</div>`;
      } else {
        bodyHtml = locs.map((l) => `
          <div class="story-info-character">
            <div class="story-info-character-name">${_esc(l.name || '(unnamed)')}</div>
            ${l.description ? `<div class="story-info-character-line"><span>Description</span> ${_esc(l.description)}</div>` : ''}
            ${l.notable     ? `<div class="story-info-character-line"><span>Notable</span> ${_esc(Array.isArray(l.notable) ? l.notable.join(', ') : l.notable)}</div>` : ''}
            ${l.notes       ? `<div class="story-info-character-line"><span>Notes</span> ${_esc(l.notes)}</div>` : ''}
          </div>
        `).join('');
      }
    } else if (kind === 'events') {
      title = '⚡ RECENT EVENTS';
      const events = ((_state.memory && _state.memory.events) || []).slice(-30).reverse();
      if (!events.length) {
        bodyHtml = `<div class="story-info-empty">No events recorded yet.</div>`;
      } else {
        bodyHtml = events.map((e) => `
          <div class="story-info-event">
            <div class="story-info-event-when">Section ${e.turn}</div>
            <div class="story-info-event-title">${_esc(e.title || '')}</div>
            ${e.description ? `<div class="story-info-event-desc">${_esc(e.description)}</div>` : ''}
          </div>
        `).join('');
      }
    }
    if (kind === 'chapters') {
      title = '📖 CHAPTER JUMP';
      const bp = _state.storyBlueprint;
      const chapters = bp && bp.chapters && Array.isArray(bp.chapters.list) ? bp.chapters.list : [];
      const cur = bp && bp.chapters ? bp.chapters.currentChapter : null;
      if (!chapters.length) {
        bodyHtml = `<div class="story-info-empty">No chapter list available yet.</div>`;
      } else {
        bodyHtml = chapters.map((c) => {
          const isCur = c.number === cur;
          return `
            <div class="story-info-chapter-row ${isCur ? 'story-info-chapter-current' : ''}" data-chapter="${c.number}">
              <div class="story-info-chapter-num">Ch ${c.number}</div>
              <div class="story-info-chapter-title">${_esc(c.title || '')}</div>
              ${isCur ? '<div class="story-info-chapter-badge">READING NOW</div>' : ''}
              <button class="story-btn story-btn-small" data-jump="${c.number}">JUMP</button>
            </div>
          `;
        }).join('');
      }
    }
    if (kind === 'bookmarks') {
      title = '🔖 BOOKMARKS';
      if (!_bookmarks.length) {
        bodyHtml = `<div class="story-info-empty">No bookmarks yet. Hover a story segment and click 🔖 to bookmark it.</div>`;
      } else {
        bodyHtml = _bookmarks.slice().reverse().map((b) => {
          const entry = _log[b.logIdx];
          const preview = entry && entry.text ? String(entry.text).slice(0, 140) + (entry.text.length > 140 ? '…' : '') : '';
          return `
            <div class="story-info-bookmark-row" data-log-idx="${b.logIdx}">
              <div class="story-info-bookmark-meta">${b.label ? _esc(b.label) + ' · ' : ''}Section ${(entry && entry.section) || '?'}${entry && typeof entry.chapter === 'number' ? ' · Ch ' + entry.chapter : ''}</div>
              <div class="story-info-bookmark-preview">${_esc(preview)}</div>
              <div class="story-info-bookmark-actions">
                <button class="story-btn story-btn-small" data-jump-idx="${b.logIdx}">JUMP</button>
                <button class="story-btn story-btn-small story-btn-danger" data-remove-idx="${b.logIdx}">REMOVE</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
    if (kind === 'stats') {
      title = '📊 STORY STATS';
      const stats = await window.storyAPI.stats(_currentSlug);
      const s = (stats && stats.stats) || {};
      const rows = [
        ['Title',              s.title || ''],
        ['Created',            s.created ? new Date(s.created).toLocaleString() : ''],
        ['Last updated',       s.updated ? new Date(s.updated).toLocaleString() : ''],
        ['Sections written',   s.sectionCount],
        ['Story segments',     s.storyEntries],
        ['Word count (prose)', (s.wordCount || 0).toLocaleString()],
        ['Chapter',            s.chapterCurrent && s.chapterTotal ? `${s.chapterCurrent} / ${s.chapterTotal}` : '—'],
        ['Characters met',     s.charactersEstablished],
        ['Places established', s.locationsEstablished],
        ['Events recorded',    s.eventsRecorded],
        ['Fixed events done',  `${s.fixedEventsTriggered || 0} / ${(s.fixedEventsTriggered || 0) + (s.fixedEventsPending || 0)}`],
        ['Reactions logged',   s.reactionCount],
        ['Bookmarks',          s.bookmarkCount],
      ];
      bodyHtml = `<div class="story-stats-grid">` + rows.map(([k, v]) => `
        <div class="story-stats-row">
          <div class="story-stats-key">${_esc(k)}</div>
          <div class="story-stats-val">${_esc(String(v == null ? '' : v))}</div>
        </div>`).join('') + `</div>`;
    }
    $('story-info-title').textContent  = title;
    $('story-info-body').innerHTML     = bodyHtml;
    _showOverlay('story-overlay-info', true);

    // Wire up dynamic elements after they exist in the DOM
    if (kind === 'chapters') {
      $('story-info-body').querySelectorAll('[data-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          _jumpToChapter(parseInt(btn.getAttribute('data-jump'), 10));
          _showOverlay('story-overlay-info', false);
        });
      });
    }
    if (kind === 'bookmarks') {
      $('story-info-body').querySelectorAll('[data-jump-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-jump-idx'), 10);
          _jumpToLogIdx(idx);
          _showOverlay('story-overlay-info', false);
        });
      });
      $('story-info-body').querySelectorAll('[data-remove-idx]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
          const res = await window.storyAPI.toggleBookmark(_currentSlug, idx, '');
          if (res && res.success) {
            _bookmarks = res.bookmarks;
            _openInfo('bookmarks');   // refresh
            _refreshScroll();          // re-render bookmark icons
          }
        });
      });
    }
  }

  // ── Debug Inspector ──────────────────────────────────────────────────
  async function _openInspect() {
    if (!_currentSlug) return;
    _showOverlay('story-overlay-inspect', true);
    $('story-inspect-content').textContent = 'Loading…';
    const res = await window.storyAPI.getDebugSnapshot(_currentSlug);
    if (!res || !res.success) {
      $('story-inspect-content').textContent = 'Failed to load snapshot: ' + (res && res.error ? res.error : 'unknown');
      return;
    }
    // Also pull the persisted reports so the REPORTS tab has data without
    // a second click. Cheap — small append-only file.
    try {
      const rep = await window.storyAPI.reports(_currentSlug);
      if (rep && rep.success) res.reports = rep.reports || [];
    } catch {}
    _inspectSnapshot = res;
    _renderInspectTab();
  }

  function _switchInspectTab(tabId) {
    _inspectActiveTab = tabId;
    document.querySelectorAll('#story-inspect-tabs .story-inspect-tab').forEach((el) => {
      el.classList.toggle('story-inspect-tab-active', el.getAttribute('data-tab') === tabId);
    });
    _renderInspectTab();
  }

  function _renderInspectTab() {
    if (!_inspectSnapshot) return;
    const content = $('story-inspect-content');
    const meta    = $('story-inspect-meta');
    const s = _inspectSnapshot;
    let body = '';           // plain text (used for text tabs + clipboard)
    let bodyHtml = null;     // rich HTML (used for characters/chapters tabs)
    let metaLine = '';
    const bp = s.blueprint || {};

    if (_inspectActiveTab === 'prompt') {
      const p = s.currentTurnPrompt || { system: '', user: '' };
      metaLine = `Preview of what a CONTINUE turn would send right now — system: ${p.system.length} chars, user: ${p.user.length} chars`;
      body = '=== SYSTEM PROMPT ===\n' + p.system + '\n\n=== USER MESSAGE ===\n' + p.user;
    } else if (_inspectActiveTab === 'characters') {
      const details = Array.isArray(bp.characterDetails) ? bp.characterDetails : [];
      const artStyle = bp.artStyle || '';
      metaLine = details.length
        ? `${details.length} character bibles · art style: ${artStyle ? artStyle.slice(0, 100) : '(none set)'}`
        : 'No character details yet — click ↻ REGEN DETAILS to generate them.';
      // Auto-select first character if none selected or the selection was
      // wiped by a regen. Sub-tab defaults to 'visual' on first open.
      if (details.length && (!_charSelected || !details.find((c) => c.id === _charSelected))) {
        _charSelected = details[0].id;
      }
      bodyHtml = details.length ? _renderCharacterDetailsHtml(details, artStyle) : `<div class="story-info-empty">No character details available. Click ↻ REGEN DETAILS to generate them.</div>`;
    } else if (_inspectActiveTab === 'chapters') {
      const details = Array.isArray(bp.chapterDetails) ? bp.chapterDetails : [];
      metaLine = details.length
        ? `${details.length} chapter deep-dives · chapters.currentChapter = ${(bp.chapters && bp.chapters.currentChapter) || 1}`
        : 'No chapter details yet — click ↻ REGEN DETAILS to generate them.';
      bodyHtml = details.length ? _renderChapterDetailsHtml(details, bp) : `<div class="story-info-empty">No chapter details available. Click ↻ REGEN DETAILS to generate them.</div>`;
    } else if (_inspectActiveTab === 'blueprint') {
      metaLine = 'Story blueprint (canonical plan). Includes plot, key characters, side characters, arc, fixed events, chapters, deep details.';
      if (_showRawJson || !bp || !Object.keys(bp).length) {
        body = bp && Object.keys(bp).length ? JSON.stringify(bp, null, 2) : '(no blueprint yet)';
      } else {
        bodyHtml = _renderBlueprintStructured(bp);
      }
    } else if (_inspectActiveTab === 'state') {
      metaLine = 'Full story state — everything on disk in story.json.';
      if (_showRawJson) {
        body = JSON.stringify(s.state, null, 2);
      } else {
        bodyHtml = _renderStateStructured(s.state || {});
      }
    } else if (_inspectActiveTab === 'overview') {
      const ov = bp.storyOverview;
      metaLine = ov
        ? 'Story overview — the core the Storyteller must know cold.'
        : 'No STORY OVERVIEW yet. Click ↻ REGEN PLAN to generate it.';
      bodyHtml = ov ? _renderStoryOverviewHtml(ov) : `<div class="story-info-empty">No story overview available. Click ↻ REGEN PLAN in the toolbar to generate.</div>`;
    } else if (_inspectActiveTab === 'chapter-summaries') {
      const summaries = Array.isArray(bp.chapterSummaries) ? bp.chapterSummaries : [];
      metaLine = summaries.length
        ? `${summaries.length} chapter summaries · broad structure for pacing.`
        : 'No chapter summaries yet. Click ↻ REGEN PLAN to generate.';
      bodyHtml = summaries.length ? _renderChapterSummariesHtml(summaries, bp) : `<div class="story-info-empty">No chapter summaries available. Click ↻ REGEN PLAN in the toolbar.</div>`;
    } else if (_inspectActiveTab === 'event-summaries') {
      const events    = Array.isArray(bp.events)         ? bp.events         : [];
      const summaries = Array.isArray(bp.eventSummaries) ? bp.eventSummaries : [];
      metaLine = events.length
        ? `${events.length} events · ${summaries.length} summarized.`
        : 'No events registered yet. Click ↻ REGEN PLAN to generate.';
      bodyHtml = events.length ? _renderEventSummariesHtml(events, summaries, bp) : `<div class="story-info-empty">No events available. Click ↻ REGEN PLAN in the toolbar.</div>`;
    } else if (_inspectActiveTab === 'reports') {
      const reports = Array.isArray(s.reports) ? s.reports : [];
      metaLine = `${reports.length} storyteller report${reports.length === 1 ? '' : 's'}.`;
      bodyHtml = _renderReportsHtml(reports);
    } else if (_inspectActiveTab === 'last-turn') {
      const t = s.lastTurnCall;
      if (!t) { body = '(no prior turn call yet)'; }
      else {
        metaLine = `Last turn call — ${t.t || ''} — meta: ${JSON.stringify(t.meta || {})}`;
        body =
          '=== USER MESSAGE THAT TRIGGERED THIS TURN ===\n' + (t.userMessage || '') +
          '\n\n=== SYSTEM PROMPT SENT ===\n' + (t.systemPrompt || '(not captured)') +
          '\n\n=== USER PROMPT SENT ===\n' + (t.userPrompt || '(not captured)') +
          '\n\n=== RAW RESPONSE ===\n' + (t.raw || '(empty)');
      }
    } else if (_inspectActiveTab === 'last-blueprint') {
      const t = s.lastBlueprintCall;
      if (!t) { body = '(no blueprint call recorded)'; }
      else {
        metaLine = `Blueprint generation call — ${t.t || ''} — parsedOk: ${t.meta && t.meta.parsedOk}`;
        body =
          '=== SYSTEM PROMPT SENT ===\n' + (t.systemPrompt || '(not captured)') +
          '\n\n=== USER PROMPT SENT ===\n' + (t.userPrompt || '(not captured)') +
          '\n\n=== RAW RESPONSE ===\n' + (t.raw || '(empty)');
      }
    } else if (_inspectActiveTab === 'last-details') {
      const t = s.lastDetailsCall;
      if (!t) { body = '(no details call recorded)'; }
      else {
        metaLine = `Details generation call — ${t.t || ''} — parsedOk: ${t.meta && t.meta.parsedOk}`;
        body =
          '=== SYSTEM PROMPT SENT ===\n' + (t.systemPrompt || '(not captured)') +
          '\n\n=== USER PROMPT SENT ===\n' + (t.userPrompt || '(not captured)') +
          '\n\n=== RAW RESPONSE ===\n' + (t.raw || '(empty)');
      }
    } else if (_inspectActiveTab === 'log') {
      metaLine = `Narrative log: ${(s.log || []).length} entries.`;
      body = JSON.stringify(s.log || [], null, 2);
    }

    meta.textContent = metaLine;
    if (bodyHtml !== null) {
      content.classList.add('story-inspect-content-rich');
      content.classList.remove('story-inspect-content-text');
      content.innerHTML = bodyHtml;
      _wireInspectCopyButtons();
    } else {
      content.classList.add('story-inspect-content-text');
      content.classList.remove('story-inspect-content-rich');
      content.textContent = body;
    }
    content.scrollTop = 0;
  }

  // Split-pane rendering: left = character list, right = selected character
  // with its own sub-tabs (Visual / Outfits / Quirks / Voice / Health /
  // Relationships / AI Prompts). Only the selected character's content
  // renders in the right pane at any time — no giant scroll of everyone.
  function _renderCharacterDetailsHtml(details, artStyle) {
    const selected = details.find((c) => c.id === _charSelected) || details[0];
    return `
      <div class="story-char-view">
        <div class="story-char-list-pane">
          <div class="story-char-list-header">CHARACTERS · ${details.length}</div>
          <div class="story-char-list">
            ${details.map((c) => _renderCharListRow(c, c.id === (selected && selected.id))).join('')}
          </div>
        </div>
        <div class="story-char-detail-pane">
          ${_renderCharDetailHeader(selected)}
          <div class="story-char-subtabs">
            ${CHAR_SUBTABS.map((t) => `<button class="story-char-subtab ${t.id === _charSubTab ? 'story-char-subtab-active' : ''}" data-subtab="${_esc(t.id)}">${_esc(t.label)}</button>`).join('')}
          </div>
          <div class="story-char-detail-body">
            ${_renderCharSubTabContent(selected, _charSubTab, artStyle)}
          </div>
        </div>
      </div>
    `;
  }

  function _renderCharListRow(c, isActive) {
    const portraitPath = _portraits[c.id];
    const portraitUrl  = portraitPath ? 'file://' + portraitPath.replace(/\\/g, '/') : null;
    const thumb = portraitUrl
      ? `<img class="story-char-list-thumb" src="${_esc(portraitUrl)}" alt="" />`
      : `<div class="story-char-list-thumb story-char-list-thumb-blank story-portrait-clickable" data-blank-portrait="${_esc(c.id || '')}" title="Copy icon AI prompt + upload portrait"></div>`;
    return `
      <button class="story-char-list-row ${isActive ? 'story-char-list-row-active' : ''}" data-char-id="${_esc(c.id || '')}">
        ${thumb}
        <div class="story-char-list-textblock">
          <div class="story-char-list-name">${_esc(c.name || '(unnamed)')}</div>
          <div class="story-char-list-role">${_esc(c.id || '')}</div>
        </div>
      </button>
    `;
  }

  function _renderCharDetailHeader(c) {
    if (!c) return '';
    const portraitPath = _portraits[c.id];
    const portraitUrl  = portraitPath ? 'file://' + portraitPath.replace(/\\/g, '/') : null;
    const portraitHtml = portraitUrl
      ? `<img class="story-char-header-portrait" src="${_esc(portraitUrl)}" alt="portrait" />`
      : `<div class="story-char-header-portrait story-char-header-portrait-blank story-portrait-clickable" data-blank-portrait="${_esc(c.id || '')}" title="Copy icon AI prompt + upload portrait"></div>`;
    return `
      <div class="story-char-detail-header">
        ${portraitHtml}
        <div class="story-char-detail-title-block">
          <div class="story-char-header-name">${_esc(c.name || '(unnamed)')}</div>
          ${c.id ? `<div class="story-char-header-id">${_esc(c.id)}</div>` : ''}
        </div>
        <div class="story-char-header-actions">
          <button class="story-btn story-btn-small" title="Upload portrait image" data-upload-portrait="${_esc(c.id || '')}">📁 UPLOAD</button>
          ${portraitPath ? `<button class="story-btn story-btn-small story-btn-danger" title="Remove portrait" data-clear-portrait="${_esc(c.id || '')}">✕</button>` : ''}
        </div>
      </div>
    `;
  }

  function _renderCharSubTabContent(c, subTab, artStyle) {
    if (!c) return `<div class="story-info-empty">Select a character.</div>`;
    switch (subTab) {
      case 'visual':
        return c.visualDescription
          ? `<div class="story-detail-body">${_esc(c.visualDescription)}</div>`
          : `<div class="story-info-empty">No visual description.</div>`;

      case 'outfits': {
        const outfits = Array.isArray(c.outfits) ? c.outfits : [];
        if (!outfits.length) return `<div class="story-info-empty">No outfits listed.</div>`;
        return outfits.map((o) => `<div class="story-detail-subitem">
          <div class="story-detail-subitem-title">${_esc(o.name || '(unnamed)')}${o.occasion ? ` — <em>${_esc(o.occasion)}</em>` : ''}</div>
          <div class="story-detail-body">${_esc(o.description || '')}</div>
        </div>`).join('');
      }

      case 'quirks': {
        const quirks = Array.isArray(c.quirks) ? c.quirks : [];
        if (!quirks.length) return `<div class="story-info-empty">No quirks listed.</div>`;
        return quirks.map((q) => `<div class="story-detail-quirk">${_esc(typeof q === 'string' ? q : (q.description || q.title || ''))}</div>`).join('');
      }

      case 'voice': {
        const v = c.voiceFingerprint || null;
        if (!v) return `<div class="story-info-empty">No voice fingerprint on file.</div>`;
        return `
          ${v.register   ? `<div class="story-detail-body"><strong>Register.</strong> ${_esc(v.register)}</div>`   : ''}
          ${v.vocabulary ? `<div class="story-detail-body"><strong>Vocabulary.</strong> ${_esc(v.vocabulary)}</div>` : ''}
          ${v.rhythm     ? `<div class="story-detail-body"><strong>Rhythm.</strong> ${_esc(v.rhythm)}</div>`         : ''}
          ${v.tells      ? `<div class="story-detail-body"><strong>Tells.</strong> ${_esc(v.tells)}</div>`           : ''}
          ${v.sampleLine ? `<div class="story-detail-body"><em>Sample line:</em> "${_esc(v.sampleLine)}"</div>` : ''}
        `;
      }

      case 'health':
        return c.healthIssues
          ? `<div class="story-detail-body">${_esc(c.healthIssues)}</div>`
          : `<div class="story-info-empty">No health notes.</div>`;

      case 'relationships': {
        const rels = Array.isArray(c.relationships) ? c.relationships : [];
        if (!rels.length) return `<div class="story-info-empty">No relationships listed.</div>`;
        return rels.map((r) => `<div class="story-detail-subitem">
          <div class="story-detail-subitem-title">${_esc(r.otherName || r.otherId || '(?)')} — <em>${_esc(r.nature || '')}</em></div>
          ${r.history  ? `<div class="story-detail-body"><strong>History.</strong> ${_esc(r.history)}</div>`  : ''}
          ${r.dynamics ? `<div class="story-detail-body"><strong>Dynamics.</strong> ${_esc(r.dynamics)}</div>` : ''}
        </div>`).join('');
      }

      case 'prompts': {
        const prompts = c.aiPrompts || {};
        return `
          <div class="story-detail-art-style-note">Art style: ${_esc(prompts.artStyle || artStyle || '(none)')}</div>
          ${_renderPromptBlock('1:1 Square Icon',           prompts.icon)}
          ${_renderPromptBlock('2:3 Portrait Photo',        prompts.portrait)}
          ${_renderPromptBlock('Character Reference Sheet', prompts.characterSheet)}
          ${_renderPromptBlock('Glamour / Editorial',       prompts.glamour)}
        `;
      }
    }
    return '';
  }

  function _renderPromptBlock(label, text) {
    if (!text) return `<div class="story-prompt-block story-prompt-block-empty">
      <div class="story-prompt-block-label">${_esc(label)}</div>
      <div class="story-prompt-block-body">(not generated)</div>
    </div>`;
    const encoded = _esc(text).replace(/"/g, '&quot;');
    return `<div class="story-prompt-block">
      <div class="story-prompt-block-label">${_esc(label)}
        <button class="story-btn story-btn-small story-prompt-copy" data-copy="${encoded}">📋 COPY</button>
      </div>
      <div class="story-prompt-block-body">${_esc(text)}</div>
    </div>`;
  }

  function _renderChapterDetailsHtml(details, bp) {
    const curCh = (bp.chapters && bp.chapters.currentChapter) || 1;
    return details.map((c) => {
      const events = Array.isArray(c.keyEvents) ? c.keyEvents : [];
      const chars  = Array.isArray(c.charactersInvolved) ? c.charactersInvolved : [];
      const isCur  = c.number === curCh;
      return `
        <div class="story-detail-card ${isCur ? 'story-detail-card-current' : ''}">
          <div class="story-detail-title">
            <span class="story-chapter-num">Ch ${c.number}</span>
            ${_esc(c.title || '')}
            ${isCur ? '<span class="story-detail-current-badge">READING NOW</span>' : ''}
          </div>
          ${c.summary ? `<div class="story-detail-section">
            <div class="story-detail-section-label">SUMMARY</div>
            <div class="story-detail-body">${_esc(c.summary)}</div>
          </div>` : ''}
          ${chars.length ? `<div class="story-detail-section">
            <div class="story-detail-section-label">CHARACTERS INVOLVED</div>
            <div class="story-detail-body">${chars.map((id) => _esc(id)).join(' · ')}</div>
          </div>` : ''}
          ${c.leadsFrom ? `<div class="story-detail-section">
            <div class="story-detail-section-label">LEADS FROM</div>
            <div class="story-detail-body">${_esc(c.leadsFrom)}</div>
          </div>` : ''}
          ${c.leadsTo ? `<div class="story-detail-section">
            <div class="story-detail-section-label">LEADS TO</div>
            <div class="story-detail-body">${_esc(c.leadsTo)}</div>
          </div>` : ''}
          ${events.length ? `<div class="story-detail-section">
            <div class="story-detail-section-label">KEY EVENTS</div>
            ${events.map((e) => `<div class="story-detail-subitem">
              <div class="story-detail-subitem-title">${_esc(e.title || '(unnamed)')}</div>
              ${e.description ? `<div class="story-detail-body">${_esc(e.description)}</div>` : ''}
              ${e.importance  ? `<div class="story-detail-body"><em>Why it matters.</em> ${_esc(e.importance)}</div>` : ''}
            </div>`).join('')}
          </div>` : ''}
          ${c.importance ? `<div class="story-detail-section">
            <div class="story-detail-section-label">CHAPTER IMPORTANCE</div>
            <div class="story-detail-body">${_esc(c.importance)}</div>
          </div>` : ''}
        </div>
      `;
    }).join('');
  }

  // ── STORY_GUIDELINES_PATCH: Inspector tab renderers ─────────────────

  // STORY OVERVIEW — the core the Storyteller must know cold.
  function _renderStoryOverviewHtml(ov) {
    const themes = Array.isArray(ov.themeReminders) ? ov.themeReminders : [];
    return `
      <div class="story-overview-doc">
        <div class="story-doc-section">
          <div class="story-doc-section-label">THE POINT OF THIS STORY</div>
          <div class="story-doc-prose">${_esc(ov.point || '(not set)')}</div>
        </div>
        <div class="story-doc-section">
          <div class="story-doc-section-label">THE READER'S EXPERIENCE</div>
          <div class="story-doc-prose">${_esc(ov.readerExperience || '(not set)')}</div>
        </div>
        <div class="story-doc-row">
          <div class="story-doc-section story-doc-half">
            <div class="story-doc-section-label">IMPETUS</div>
            <div class="story-doc-prose">${_esc(ov.impetus || '(not set)')}</div>
          </div>
          <div class="story-doc-section story-doc-half">
            <div class="story-doc-section-label">DRAW</div>
            <div class="story-doc-prose">${_esc(ov.draw || '(not set)')}</div>
          </div>
        </div>
        <div class="story-doc-section">
          <div class="story-doc-section-label">CONCLUSION</div>
          <div class="story-doc-prose">${_esc(ov.conclusion || '(not set)')}</div>
        </div>
        ${themes.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">THEME REMINDERS</div>
          <div class="story-doc-chips">${themes.map((t) => `<span class="story-doc-chip">${_esc(t)}</span>`).join('')}</div>
        </div>` : ''}
        <div class="story-doc-section">
          <div class="story-doc-section-label">CHARACTERS (the ones who matter)</div>
          <div class="story-doc-prose">${_esc(ov.characterCoreSummary || '(not set)')}</div>
        </div>
      </div>
    `;
  }

  // CHAPTER SUMMARIES — split-pane like CHARACTERS.
  function _renderChapterSummariesHtml(summaries, bp) {
    const chapters = (bp.chapters && Array.isArray(bp.chapters.list)) ? bp.chapters.list : [];
    // Build a resolved list matching chapter order
    const byNum = new Map(summaries.map((s) => [s.chapterNumber, s]));
    const rows = chapters.map((c) => byNum.get(c.number) || { chapterNumber: c.number, title: c.title, sectionBudget: c.sectionBudget });
    if (!_chapterSummarySelected || !rows.find((r) => r.chapterNumber === _chapterSummarySelected)) {
      _chapterSummarySelected = rows[0] ? rows[0].chapterNumber : null;
    }
    const selected = rows.find((r) => r.chapterNumber === _chapterSummarySelected) || rows[0];
    const chObj = chapters.find((c) => c.number === (selected && selected.chapterNumber));
    return `
      <div class="story-char-view">
        <div class="story-char-list-pane">
          <div class="story-char-list-header">CHAPTERS · ${rows.length}</div>
          <div class="story-char-list">
            ${rows.map((r) => {
              const cur = (bp.chapters && bp.chapters.currentChapter) || 1;
              const used = chapters.find((c) => c.number === r.chapterNumber);
              const usedN = used && typeof used.sectionsUsed  === 'number' ? used.sectionsUsed  : 0;
              const budgetN = used && typeof used.sectionBudget === 'number' ? used.sectionBudget : (r.sectionBudget || 3);
              return `<button class="story-char-list-row ${r.chapterNumber === (selected && selected.chapterNumber) ? 'story-char-list-row-active' : ''}" data-chsum="${r.chapterNumber}">
                <div class="story-char-list-textblock">
                  <div class="story-char-list-name">Ch ${r.chapterNumber}${r.chapterNumber === cur ? ' · CURRENT' : ''}</div>
                  <div class="story-char-list-role">${_esc(r.title || '')}</div>
                  ${_pacingBar(usedN, budgetN)}
                </div>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="story-char-detail-pane">
          ${selected ? _renderChapterSummaryDetail(selected, chObj) : '<div class="story-info-empty">Pick a chapter.</div>'}
        </div>
      </div>
    `;
  }

  function _renderChapterSummaryDetail(s, chObj) {
    const budget = (chObj && typeof chObj.sectionBudget === 'number') ? chObj.sectionBudget : (s.sectionBudget || 3);
    const used   = (chObj && typeof chObj.sectionsUsed  === 'number') ? chObj.sectionsUsed  : 0;
    const chars  = Array.isArray(s.charactersInvolved) ? s.charactersInvolved : [];
    return `
      <div class="story-doc-inner">
        <div class="story-doc-header">
          <div class="story-doc-header-title">CHAPTER ${s.chapterNumber}${s.title ? ' · "' + _esc(s.title) + '"' : ''}</div>
          <div class="story-doc-header-meta">${used}/${budget} sections used</div>
        </div>
        ${_pacingBar(used, budget)}
        ${s.kickoff        ? _docSection('KICKOFF',          s.kickoff)        : ''}
        ${s.blendFromPrior ? _docSection('BLEND FROM PRIOR', s.blendFromPrior) : ''}
        ${s.driver         ? _docSection('DRIVER',           s.driver)         : ''}
        ${s.closer         ? _docSection('CLOSER',           s.closer)         : ''}
        ${s.blendToNext    ? _docSection('BLEND TO NEXT',    s.blendToNext)    : ''}
        ${chars.length     ? `<div class="story-doc-section">
          <div class="story-doc-section-label">CHARACTERS INVOLVED</div>
          <div class="story-doc-prose">${chars.map((id) => _esc(id)).join(' · ')}</div>
        </div>` : ''}
        ${s.importance     ? _docSection('IMPORTANCE',       s.importance)     : ''}
      </div>
    `;
  }

  // EVENT SUMMARIES — split-pane grouped by chapter.
  function _renderEventSummariesHtml(events, summaries, bp) {
    const summariesById = new Map(summaries.map((s) => [s.id, s]));
    const sortedEvents = events.slice().sort((a, b) => {
      const c = (a.chapterNumber || 0) - (b.chapterNumber || 0);
      if (c !== 0) return c;
      return (a.orderInChapter || 0) - (b.orderInChapter || 0);
    });
    if (!_eventSummarySelected || !sortedEvents.find((e) => e.id === _eventSummarySelected)) {
      _eventSummarySelected = sortedEvents[0] ? sortedEvents[0].id : null;
    }
    const selected = sortedEvents.find((e) => e.id === _eventSummarySelected) || sortedEvents[0];
    const selectedSummary = selected ? summariesById.get(selected.id) : null;
    return `
      <div class="story-char-view">
        <div class="story-char-list-pane">
          <div class="story-char-list-header">EVENTS · ${sortedEvents.length}</div>
          <div class="story-char-list">
            ${sortedEvents.map((e) => {
              const budgetN = typeof e.sectionBudget === 'number' ? e.sectionBudget : 2;
              const usedN   = typeof e.sectionsUsed  === 'number' ? e.sectionsUsed  : 0;
              const statusClass = 'story-event-status-' + (e.status || 'pending');
              return `<button class="story-char-list-row ${e.id === (selected && selected.id) ? 'story-char-list-row-active' : ''}" data-evsum="${_esc(e.id)}">
                <div class="story-char-list-textblock">
                  <div class="story-char-list-name">Ch ${e.chapterNumber} · ${_esc(e.title || e.id)}</div>
                  <div class="story-char-list-role"><span class="${statusClass}">${_esc(e.status || 'pending')}</span> · ${usedN}/${budgetN}</div>
                  ${_pacingBar(usedN, budgetN)}
                </div>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="story-char-detail-pane">
          ${selected ? _renderEventSummaryDetail(selected, selectedSummary) : '<div class="story-info-empty">Pick an event.</div>'}
        </div>
      </div>
    `;
  }

  function _renderEventSummaryDetail(ev, s) {
    const budget = typeof ev.sectionBudget === 'number' ? ev.sectionBudget : 2;
    const used   = typeof ev.sectionsUsed  === 'number' ? ev.sectionsUsed  : 0;
    const who    = s && Array.isArray(s.who_is_involved) ? s.who_is_involved : [];
    return `
      <div class="story-doc-inner">
        <div class="story-doc-header">
          <div class="story-doc-header-title">${_esc(ev.title || ev.id)}</div>
          <div class="story-doc-header-meta">Chapter ${ev.chapterNumber} · order ${ev.orderInChapter || '?'} · status ${_esc(ev.status || 'pending')} · ${used}/${budget} sections</div>
        </div>
        ${_pacingBar(used, budget)}
        ${s ? `
          ${s.kickoff           ? _docSection('KICKOFF',           s.kickoff)           : ''}
          ${who.length          ? `<div class="story-doc-section">
            <div class="story-doc-section-label">WHO IS INVOLVED</div>
            <div class="story-doc-prose">${who.map((id) => _esc(id)).join(' · ')}</div>
          </div>` : ''}
          ${s.reader_experience ? _docSection('READER EXPERIENCE', s.reader_experience) : ''}
          ${s.why_it_matters    ? _docSection('WHY IT MATTERS',    s.why_it_matters)    : ''}
          ${s.aftermath         ? _docSection('AFTERMATH',         s.aftermath)         : ''}
        ` : `<div class="story-info-empty">No summary written for this event yet.</div>`}
      </div>
    `;
  }

  // REPORTS — flat table with expandable reason.
  function _renderReportsHtml(reports) {
    if (!reports.length) return `<div class="story-info-empty">No overrun reports. The Storyteller has stayed within budget so far.</div>`;
    const totalEvents  = _state && _state.storyBlueprint && Array.isArray(_state.storyBlueprint.events) ? _state.storyBlueprint.events.length : 0;
    const eventReports = reports.filter((r) => r.kind === 'event_overrun');
    const rate         = totalEvents ? Math.round((eventReports.length / totalEvents) * 100) : 0;
    const deltas       = reports.map((r) => (Number(r.requested_new_budget) || 0) - (Number(r.original_budget) || 0)).filter((n) => Number.isFinite(n));
    const avgDelta     = deltas.length ? (deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1) : '0';
    const rowsHtml = reports.map((r, idx) => `
      <tr class="story-report-row" data-report-idx="${idx}">
        <td>${r.section || r.turn || '?'}</td>
        <td>${_esc(r.kind || '?')}</td>
        <td>${_esc(String(r.scope_id || '?'))}</td>
        <td>${r.original_budget || '?'}</td>
        <td>${r.requested_new_budget || '?'}</td>
        <td>+${(Number(r.requested_new_budget) || 0) - (Number(r.original_budget) || 0)}</td>
        <td>${_esc((r.reason || '').slice(0, 80))}${(r.reason || '').length > 80 ? '…' : ''}</td>
      </tr>
    `).join('');
    return `
      <div class="story-doc-inner">
        <div class="story-report-metrics">
          <div class="story-report-metric"><div class="story-report-metric-label">Reports</div><div class="story-report-metric-value">${reports.length}</div></div>
          <div class="story-report-metric"><div class="story-report-metric-label">Event overrun rate</div><div class="story-report-metric-value">${eventReports.length}/${totalEvents} (${rate}%)</div></div>
          <div class="story-report-metric"><div class="story-report-metric-label">Avg request delta</div><div class="story-report-metric-value">+${avgDelta}</div></div>
        </div>
        <table class="story-report-table">
          <thead><tr><th>Section</th><th>Kind</th><th>Scope</th><th>Orig</th><th>Req</th><th>Δ</th><th>Reason</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // BLUEPRINT structured — replaces the raw-JSON dump. Toggle to RAW via
  // the { } RAW JSON button in the toolbar.
  function _renderBlueprintStructured(bp) {
    const keyChars  = Array.isArray(bp.keyCharacters)  ? bp.keyCharacters  : [];
    const sideChars = Array.isArray(bp.sideCharacters) ? bp.sideCharacters : [];
    const fixed     = Array.isArray(bp.fixedEvents)    ? bp.fixedEvents    : [];
    const hints     = Array.isArray(bp.plantedHints)   ? bp.plantedHints   : [];
    const themes    = Array.isArray(bp.themes)         ? bp.themes         : [];
    const chapters  = (bp.chapters && Array.isArray(bp.chapters.list)) ? bp.chapters.list : [];
    const sl        = _state && _state.storyLength ? _state.storyLength : null;
    return `
      <div class="story-doc-inner">
        ${sl ? `<div class="story-doc-header">
          <div class="story-doc-header-title">${_esc(sl.label || '')} · target ~${sl.targetSections || '?'} sections</div>
        </div>` : ''}
        ${bp.premise ? _docSection('PREMISE',        bp.premise)     : ''}
        ${bp.plotSummary ? _docSection('PLOT SUMMARY', bp.plotSummary) : ''}
        ${themes.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">THEMES</div>
          <div class="story-doc-chips">${themes.map((t) => `<span class="story-doc-chip">${_esc(t)}</span>`).join('')}</div>
        </div>` : ''}
        ${bp.tone     ? _docSection('TONE',      bp.tone)     : ''}
        ${bp.artStyle ? _docSection('ART STYLE', bp.artStyle) : ''}
        ${keyChars.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">KEY CHARACTERS (${keyChars.length})</div>
          <div class="story-doc-grid">${keyChars.map((c) => `
            <div class="story-doc-cell">
              <div class="story-doc-cell-title">${_esc(c.name || c.id || '?')}</div>
              <div class="story-doc-cell-meta">${_esc(c.role || '')} · immunity: ${_esc((c.plot_immunity || 'medium').toUpperCase())}</div>
              ${c.description ? `<div class="story-doc-cell-body">${_esc(c.description)}</div>` : ''}
            </div>`).join('')}</div>
        </div>` : ''}
        ${sideChars.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">SIDE CHARACTERS (${sideChars.length})</div>
          <div class="story-doc-list">${sideChars.map((c) => `<div class="story-doc-listitem"><strong>${_esc(c.name || c.id || '?')}</strong> — ${_esc(c.role || '')}${c.purpose ? ' — ' + _esc(c.purpose) : ''}</div>`).join('')}</div>
        </div>` : ''}
        ${bp.arc ? `<div class="story-doc-section">
          <div class="story-doc-section-label">ARC</div>
          <div class="story-doc-row">
            <div class="story-doc-cell story-doc-third"><div class="story-doc-cell-title">BEGINNING</div><div class="story-doc-cell-body">${_esc((bp.arc.beginning || {}).summary || '')}</div></div>
            <div class="story-doc-cell story-doc-third"><div class="story-doc-cell-title">MIDDLE</div><div class="story-doc-cell-body">${_esc((bp.arc.middle || {}).summary || '')}</div></div>
            <div class="story-doc-cell story-doc-third"><div class="story-doc-cell-title">END</div><div class="story-doc-cell-body">${_esc((bp.arc.end || {}).summary || '')}</div></div>
          </div>
        </div>` : ''}
        ${fixed.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">FIXED EVENTS (${fixed.length})</div>
          <div class="story-doc-list">${fixed.map((e) => `<div class="story-doc-listitem"><strong>[${_esc((e.status || 'pending').toUpperCase())}]</strong> ${_esc(e.title || '')} — <em>${_esc(e.when || '')}</em>${e.description ? ' — ' + _esc(e.description) : ''}</div>`).join('')}</div>
        </div>` : ''}
        ${hints.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">PLANTED HINTS (${hints.length})</div>
          <div class="story-doc-list">${hints.map((h) => `<div class="story-doc-listitem"><strong>[${_esc((h.status || 'planted').toUpperCase())}]</strong> ${_esc(h.description || '')} — pays off: ${_esc(h.paysOffAtEvent || '?')}</div>`).join('')}</div>
        </div>` : ''}
        ${chapters.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">CHAPTERS (${chapters.length})</div>
          <div class="story-doc-list">${chapters.map((c) => {
            const budget = typeof c.sectionBudget === 'number' ? c.sectionBudget : 3;
            const used   = typeof c.sectionsUsed  === 'number' ? c.sectionsUsed  : 0;
            return `<div class="story-doc-listitem">
              <div><strong>Ch ${c.number}</strong> [${_esc(c.act || '?')}] ${_esc(c.title || '')} — ${used}/${budget} sections</div>
              ${_pacingBar(used, budget)}
            </div>`;
          }).join('')}</div>
        </div>` : ''}
        <div class="story-doc-section">
          <div class="story-doc-section-label">PLANNING POSITION</div>
          <div class="story-doc-prose">Act "${_esc(bp.currentAct || '?')}" · Beat "${_esc(bp.currentBeat || '?')}" · Progress ${Math.round(100 * (bp.progress || 0))}% · Chapter ${(bp.chapters && bp.chapters.currentChapter) || 1}/${(bp.chapters && bp.chapters.total) || (chapters.length || 1)}</div>
        </div>
      </div>
    `;
  }

  // STATE structured — surface the top-level fields as labeled cards.
  function _renderStateStructured(state) {
    const memory = state.memory || {};
    const sc = state.scene || {};
    const mc = state.mainCharacter || {};
    const sl = state.storyLength || {};
    const chars = Array.isArray(memory.characters) ? memory.characters : [];
    const locs  = Array.isArray(memory.locations)  ? memory.locations  : [];
    const items = Array.isArray(memory.items)      ? memory.items      : [];
    const goals = Array.isArray(memory.goals)      ? memory.goals      : [];
    return `
      <div class="story-doc-inner">
        <div class="story-doc-section">
          <div class="story-doc-section-label">METADATA</div>
          <div class="story-doc-prose">${_esc(state.title || '?')} · type: ${_esc(state.storyTypeLabel || state.storyType || '?')} · length: ${_esc(sl.label || '?')} (target ~${sl.targetSections || '?'} sections)</div>
        </div>
        <div class="story-doc-section">
          <div class="story-doc-section-label">MAIN CHARACTER</div>
          <div class="story-doc-prose"><strong>${_esc(mc.name || '(unnamed)')}</strong> — ${_esc(mc.gender || '')}</div>
          ${mc.background  ? `<div class="story-doc-prose"><em>Background.</em> ${_esc(mc.background)}</div>`  : ''}
          ${mc.personality ? `<div class="story-doc-prose"><em>Personality.</em> ${_esc(mc.personality)}</div>` : ''}
          ${mc.appearance  ? `<div class="story-doc-prose"><em>Appearance.</em> ${_esc(mc.appearance)}</div>`  : ''}
        </div>
        <div class="story-doc-section">
          <div class="story-doc-section-label">CURRENT SCENE</div>
          <div class="story-doc-prose"><strong>${_esc(sc.name || '?')}</strong>${sc.location ? ' @ ' + _esc(sc.location) : ''}${sc.time ? ' — ' + _esc(sc.time) : ''}</div>
          ${sc.situation ? `<div class="story-doc-prose">${_esc(sc.situation)}</div>` : ''}
        </div>
        ${memory.storySummary ? _docSection('STORY SO FAR', memory.storySummary) : ''}
        ${chars.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">ESTABLISHED CHARACTERS (${chars.length})</div>
          <div class="story-doc-list">${chars.map((c) => `<div class="story-doc-listitem"><strong>${_esc(c.name || c.id || '?')}</strong>${c.role ? ' — ' + _esc(c.role) : ''}${c.description ? ' — ' + _esc(c.description) : ''}</div>`).join('')}</div>
        </div>` : ''}
        ${locs.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">ESTABLISHED LOCATIONS (${locs.length})</div>
          <div class="story-doc-list">${locs.map((l) => `<div class="story-doc-listitem"><strong>${_esc(l.name || l.id || '?')}</strong>${l.description ? ' — ' + _esc(l.description) : ''}</div>`).join('')}</div>
        </div>` : ''}
        ${items.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">ITEMS (${items.length})</div>
          <div class="story-doc-list">${items.map((i) => `<div class="story-doc-listitem"><strong>${_esc(i.name || i.id || '?')}</strong>${i.holder ? ' — held by: ' + _esc(i.holder) : ''}${i.description ? ' — ' + _esc(i.description) : ''}</div>`).join('')}</div>
        </div>` : ''}
        ${goals.length ? `<div class="story-doc-section">
          <div class="story-doc-section-label">GOALS (${goals.length})</div>
          <div class="story-doc-list">${goals.map((g) => `<div class="story-doc-listitem"><strong>[${_esc((g.status || 'active').toUpperCase())}]</strong> ${_esc(g.title || '?')}${g.description ? ' — ' + _esc(g.description) : ''}</div>`).join('')}</div>
        </div>` : ''}
        <div class="story-doc-section">
          <div class="story-doc-section-label">COUNTS</div>
          <div class="story-doc-prose">Turn: ${state.turnCount || 0} · Events in memory: ${Array.isArray(memory.events) ? memory.events.length : 0} · Lore: ${Array.isArray(memory.lore) ? memory.lore.length : 0}</div>
        </div>
      </div>
    `;
  }

  function _docSection(label, body) {
    return `<div class="story-doc-section">
      <div class="story-doc-section-label">${_esc(label)}</div>
      <div class="story-doc-prose">${_esc(String(body || ''))}</div>
    </div>`;
  }

  // ── Toolbar handlers ─────────────────────────────────────────────────

  function _toggleRawJson() {
    _showRawJson = !_showRawJson;
    const btn = $('story-btn-inspect-raw-toggle');
    if (btn) btn.classList.toggle('story-btn-toggled', _showRawJson);
    _renderInspectTab();
  }

  async function _regeneratePlan() {
    if (!_currentSlug || !_state) return;
    const proceed = await window.storyAPI.confirm(
      'Regenerate the pacing plan?',
      'This runs the story-overview + chapter-summaries + event-summaries setup chain. Existing blueprint plot data is preserved; only the pacing layer is refreshed. Takes several minutes.',
      'REGEN PLAN', 'CANCEL'
    );
    if (!proceed) return;
    // Clear the pacing layer so the chain regenerates it. Blueprint plot data
    // (plotSummary, keyCharacters, arc, fixedEvents, chapters) is preserved.
    _state.storyBlueprint.storyOverview     = null;
    _state.storyBlueprint.chapterSummaries  = [];
    _state.storyBlueprint.eventSummaries    = [];
    _state.storyBlueprint.events            = [];
    _showOverlay('story-overlay-inspect', false);
    const ok = await _runSetupChain({ includeBlueprint: false, includeOpening: false });
    _hideBusy();
    if (ok) {
      _refreshHeader();
      _openInspect();
    }
  }

  function _showReportBanner(report) {
    const banner = $('story-report-banner');
    const title  = $('story-report-banner-title');
    const body   = $('story-report-banner-body');
    if (!banner || !title || !body) return;
    const kind = String(report.kind || 'overrun').replace(/_/g, ' ').toUpperCase();
    title.textContent = `⚠ STORYTELLER REPORT — ${kind}`;
    const scopeLabel = report.scope_id != null ? String(report.scope_id) : '?';
    body.innerHTML = `<strong>${_esc(scopeLabel)}</strong> requested ${report.original_budget || '?'} → ${report.requested_new_budget || '?'} sections<br>` +
                     `<em>${_esc((report.reason || '').slice(0, 400))}</em>`;
    banner.classList.remove('hidden');
    // Also refresh the pacing card so the new budget shows immediately.
    _refreshPacingCard();
  }

  function _wireInspectCopyButtons() {
    document.querySelectorAll('.story-prompt-copy').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(text);
          const orig = btn.textContent;
          btn.textContent = '✓ COPIED';
          setTimeout(() => { btn.textContent = orig; }, 1200);
        } catch (err) {
          alert('Clipboard write failed: ' + err.message);
        }
      });
    });
    // Portrait upload / clear
    document.querySelectorAll('[data-upload-portrait]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _uploadPortrait(btn.getAttribute('data-upload-portrait'));
      });
    });
    document.querySelectorAll('[data-clear-portrait]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _clearPortrait(btn.getAttribute('data-clear-portrait'));
      });
    });
    // Blank-portrait tiles: click copies the icon AI prompt + opens upload
    document.querySelectorAll('[data-blank-portrait]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        _handleBlankPortraitClick(el.getAttribute('data-blank-portrait'));
      });
    });
    // CHARACTERS tab split-view: char list row selects a character
    document.querySelectorAll('.story-char-list-row').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-char-id');
        if (!id || id === _charSelected) return;
        _charSelected = id;
        _renderInspectTab();
      });
    });
    // CHARACTERS tab split-view: sub-tab click switches the right pane
    document.querySelectorAll('.story-char-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.getAttribute('data-subtab');
        if (!st || st === _charSubTab) return;
        _charSubTab = st;
        _renderInspectTab();
      });
    });
    // CHAPTER SUMMARIES tab: row selection
    document.querySelectorAll('[data-chsum]').forEach((row) => {
      row.addEventListener('click', () => {
        const n = parseInt(row.getAttribute('data-chsum'), 10);
        if (!Number.isFinite(n) || n === _chapterSummarySelected) return;
        _chapterSummarySelected = n;
        _renderInspectTab();
      });
    });
    // EVENT SUMMARIES tab: row selection
    document.querySelectorAll('[data-evsum]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-evsum');
        if (!id || id === _eventSummarySelected) return;
        _eventSummarySelected = id;
        _renderInspectTab();
      });
    });
    // REPORTS tab: click a row to expand the reason.
    document.querySelectorAll('.story-report-row').forEach((row) => {
      row.addEventListener('click', () => {
        row.classList.toggle('story-report-row-expanded');
        const idx = parseInt(row.getAttribute('data-report-idx'), 10);
        const reports = _inspectSnapshot && Array.isArray(_inspectSnapshot.reports) ? _inspectSnapshot.reports : [];
        const rep = reports[idx];
        const cell = row.querySelector('td:last-child');
        if (rep && cell) cell.textContent = row.classList.contains('story-report-row-expanded') ? (rep.reason || '') : ((rep.reason || '').slice(0, 80) + ((rep.reason || '').length > 80 ? '…' : ''));
      });
    });
  }

  async function _copyInspectContent() {
    const content = $('story-inspect-content');
    // Rich HTML tabs — copy visible text (innerText handles the layout).
    const text = content.classList.contains('story-inspect-content-rich')
      ? (content.innerText || '')
      : (content.textContent || '');
    try {
      await navigator.clipboard.writeText(text);
      const btn = $('story-btn-inspect-copy');
      const orig = btn.textContent;
      btn.textContent = '✓ COPIED';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    } catch (e) {
      alert('Clipboard write failed: ' + e.message);
    }
  }

  async function _regenerateDetails() {
    if (!_currentSlug) return;
    const ok = await window.storyAPI.confirm(
      'Generate missing details?',
      'Runs the Storyteller to fill in ANY character or chapter details that are missing. Characters already generated are skipped. Chapters already generated are skipped. Runs in small batches (3 characters per call) so each individual call finishes quickly and progress is saved incrementally. Takes ~1–3 minutes per batch.',
      'Generate',
      'Cancel',
    );
    if (!ok) return;
    _showOverlay('story-overlay-inspect', false);
    _showBusy('The Storyteller is warming up…');
    // Subscribe to per-batch progress updates so the busy overlay can
    // show which batch is currently running instead of a static message.
    const offProgress = window.storyAPI.onDetailsProgress((payload) => {
      const label = payload && payload.label ? payload.label : 'Working…';
      const bl = document.getElementById('story-busy-label');
      if (bl) bl.textContent = 'The Storyteller: ' + label;
    });
    const res = await window.storyAPI.generateDetails(_currentSlug, false);   // force=false — never redo finished work
    try { offProgress(); } catch {}
    _hideBusy();
    if (res && res.success) {
      _state = res.state;
      _refreshHeader();
      _openInspect();
      if (res.partial && Array.isArray(res.warnings) && res.warnings.length) {
        console.warn('[TextStory] Details generation partial:', res.warnings);
        setTimeout(() => alert('Some details calls failed but others completed:\n\n' + res.warnings.join('\n\n')), 400);
      }
    } else {
      alert('Details generation failed: ' + (res && res.error ? res.error : 'unknown'));
      _openInspect();
    }
  }

  // ── Live companion reactions ────────────────────────────────────────
  async function _fireReaction() {
    if (!_currentSlug) return;
    // Fire and forget — non-blocking
    try {
      const res = await window.storyAPI.react(_currentSlug);
      if (res && res.success && res.reaction && res.reaction.dialogue) {
        _reactions.push({
          section:  _state && _state.turnCount,
          companionName: res.reaction.companionName,
          dialogue: res.reaction.dialogue,
          thoughts: res.reaction.thoughts,
          emotion:  res.reaction.emotion,
          t:        new Date().toISOString(),
        });
        _refreshReactionsPanel();
      }
    } catch (e) {
      console.warn('[TextStory] reaction failed:', e);
    }
  }
  function _refreshReactionsPanel() {
    const panel = $('story-reactions-panel');
    const list  = $('story-reactions-list');
    const label = $('story-reactions-label-name');
    if (!panel || !list) return;
    if (!_reactions.length) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    // Name comes from the first reaction (they'll all be the same active companion)
    label.textContent = ((_reactions[_reactions.length - 1] || {}).companionName || 'Companion').toUpperCase() + '\'S REACTIONS';
    // Show last 6 in reverse (most recent first)
    const recent = _reactions.slice(-6).reverse();
    list.innerHTML = recent.map((r) => `
      <div class="story-reaction-item">
        <div class="story-reaction-meta">
          <span class="story-reaction-section">§${r.section || '?'}</span>
          <span class="story-reaction-emotion">(${_esc(r.emotion || 'neutral')})</span>
        </div>
        <div class="story-reaction-dialogue">${_esc(r.dialogue || '')}</div>
      </div>
    `).join('');
  }

  // ── Companion suggests a choice ─────────────────────────────────────
  async function _requestSuggestChoice() {
    if (!_currentSlug) return;
    const result = $('story-suggest-result');
    if (!result) return;
    result.classList.remove('hidden');
    result.innerHTML = `<div class="story-suggest-pending">Asking your companion…</div>`;
    const res = await window.storyAPI.suggestChoice(_currentSlug);
    if (!res || !res.success) {
      result.innerHTML = `<div class="story-suggest-error">${_esc((res && res.error) || 'Failed')}</div>`;
      return;
    }
    const s = res.suggestion || {};
    result.innerHTML = `
      <div class="story-suggest-header">${_esc((s.companionName || 'Companion'))} <span class="story-suggest-emotion">(${_esc(s.emotion || 'neutral')})</span></div>
      <div class="story-suggest-body">${_esc(s.dialogue || '')}</div>
    `;
  }

  // ── Chapter jump ────────────────────────────────────────────────────
  function _jumpToChapter(chapterNum) {
    if (!Number.isFinite(chapterNum)) return;
    // Find the first log entry (kind: 'story') whose chapter matches.
    const idx = _log.findIndex((e) => e && e.kind === 'story' && e.chapter === chapterNum);
    if (idx < 0) return;
    _jumpToLogIdx(idx);
  }
  function _jumpToLogIdx(idx) {
    if (idx < 0) return;
    // Log entries render in order — the Nth story entry is the (N)th
    // .story-entry-story in the scroll. Query that element and scroll.
    const el = $('story-scroll').querySelector(`[data-log-idx="${idx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Bookmarks ───────────────────────────────────────────────────────
  async function _toggleBookmark(logIdx) {
    if (!_currentSlug) return;
    const res = await window.storyAPI.toggleBookmark(_currentSlug, logIdx, '');
    if (res && res.success) {
      _bookmarks = res.bookmarks;
      _refreshScroll();
    }
  }

  // ── Search ──────────────────────────────────────────────────────────
  function _openSearch() {
    $('story-search-bar').classList.remove('hidden');
    setTimeout(() => $('story-search-input').focus(), 20);
  }
  function _closeSearch() {
    $('story-search-bar').classList.add('hidden');
    $('story-search-input').value = '';
    _searchMatches = [];
    _searchIndex   = 0;
    $('story-search-count').textContent = '';
    // Clear highlights
    _refreshScroll();
  }
  function _updateSearchMatches() {
    const q = ($('story-search-input').value || '').trim().toLowerCase();
    if (!q) { _searchMatches = []; _searchIndex = 0; $('story-search-count').textContent = ''; _refreshScroll(); return; }
    _searchMatches = [];
    _log.forEach((entry, i) => {
      if (!entry) return;
      const hay = String(entry.text || entry.choice || '').toLowerCase();
      if (hay.includes(q)) _searchMatches.push(i);
    });
    _searchIndex = 0;
    $('story-search-count').textContent = _searchMatches.length ? `${_searchMatches.length} matches` : 'no matches';
    _refreshScroll();
    if (_searchMatches.length) _jumpToLogIdx(_searchMatches[0]);
  }
  function _searchNext(dir) {
    if (!_searchMatches.length) return;
    _searchIndex = (_searchIndex + dir + _searchMatches.length) % _searchMatches.length;
    $('story-search-count').textContent = `${_searchIndex + 1} of ${_searchMatches.length}`;
    _jumpToLogIdx(_searchMatches[_searchIndex]);
  }

  // ── Reading zoom ────────────────────────────────────────────────────
  function _applyProseScale() {
    document.documentElement.style.setProperty('--story-prose-scale', String(_proseScale));
  }
  function _zoomProse(delta) {
    _proseScale = Math.max(0.7, Math.min(1.8, _proseScale + delta));
    localStorage.setItem('story-prose-scale', String(_proseScale));
    _applyProseScale();
  }

  // ── Global keydown (Ctrl+F, Ctrl+/-, Esc) ───────────────────────────
  function _handleGlobalKeydown(e) {
    if (!document.body.classList.contains('story-mode')) return;
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      _openSearch();
    } else if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      _zoomProse(0.1);
    } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '-') {
      e.preventDefault();
      _zoomProse(-0.1);
    } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '0') {
      e.preventDefault();
      _proseScale = 1;
      localStorage.setItem('story-prose-scale', '1');
      _applyProseScale();
    } else if (e.key === 'Escape' && !$('story-search-bar').classList.contains('hidden')) {
      _closeSearch();
    }
  }

  // ── Export prose ────────────────────────────────────────────────────
  async function _openExport() {
    if (!_currentSlug) return;
    const choice = await window.storyAPI.confirm(
      'Export the story\'s prose',
      'Choose format. Markdown preserves chapter headers and scene labels; plain text is simpler for e-readers.',
      'Markdown (.md)',
      'Plain Text (.txt)',
    );
    // confirm returns true for "confirm" (md) and false for "cancel" (txt).
    // Users can also close the dialog; but with only two options we treat both truthy paths as valid.
    const format = choice ? 'md' : 'txt';
    const res = await window.storyAPI.exportStory(_currentSlug, format);
    if (res && res.success) {
      alert(`Exported to ${res.filePath} (${res.byteCount.toLocaleString()} bytes).`);
    } else if (res && res.canceled) {
      // no-op — user cancelled the file picker
    } else if (res && res.error) {
      alert('Export failed: ' + res.error);
    }
  }

  // ── Portrait upload (called from inspector character card) ──────────
  async function _uploadPortrait(characterId) {
    if (!_currentSlug || !characterId) return;
    const res = await window.storyAPI.uploadPortrait(_currentSlug, characterId);
    if (res && res.success) {
      _portraits[characterId] = res.portraitPath;
      // Refresh inspector if open
      if (!$('story-overlay-inspect').classList.contains('hidden')) _openInspect();
    } else if (res && res.canceled) {
      // no-op
    } else if (res && res.error) {
      alert('Portrait upload failed: ' + res.error);
    }
  }
  async function _clearPortrait(characterId) {
    if (!_currentSlug || !characterId) return;
    const ok = await window.storyAPI.confirm(
      'Remove portrait?',
      'The portrait image for this character will be deleted from disk.',
      'Remove',
      'Cancel',
    );
    if (!ok) return;
    await window.storyAPI.clearPortrait(_currentSlug, characterId);
    delete _portraits[characterId];
    if (!$('story-overlay-inspect').classList.contains('hidden')) _openInspect();
  }

  // Blank-portrait click: copy the character's 1:1 icon AI prompt to the
  // clipboard, flash a toast, then open the file-picker upload dialog.
  // Fires from any blank tile in the char list, char detail header, or the
  // SCENE CHARACTERS sidebar card.
  async function _handleBlankPortraitClick(characterId) {
    if (!_currentSlug || !characterId) return;
    // Look up the icon prompt from characterDetails
    const bp = _state && _state.storyBlueprint;
    const details = (bp && Array.isArray(bp.characterDetails)) ? bp.characterDetails : [];
    const det = details.find((c) => c.id === characterId);
    const iconPrompt = det && det.aiPrompts && det.aiPrompts.icon ? det.aiPrompts.icon : '';

    if (iconPrompt) {
      try {
        await navigator.clipboard.writeText(iconPrompt);
        _flashToast('Icon AI prompt copied to clipboard');
      } catch (e) {
        console.warn('[TextStory] clipboard write failed:', e);
      }
    } else {
      _flashToast('No AI icon prompt found for this character — opening upload dialog');
    }
    // Then trigger the upload dialog
    await _uploadPortrait(characterId);
  }

  // Small transient status message. Uses an existing #toast element if the
  // main app has one; otherwise falls back to a self-injected overlay.
  function _flashToast(msg) {
    let t = document.getElementById('story-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'story-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('story-toast-visible');
    clearTimeout(_flashToast._timer);
    _flashToast._timer = setTimeout(() => {
      t.classList.remove('story-toast-visible');
    }, 2600);
  }

  // ── Rendering: scroll ────────────────────────────────────────────────
  function _refreshScroll() {
    const scroll = $('story-scroll');
    if (!scroll) return;
    const searchQ = (($('story-search-input') && $('story-search-input').value) || '').trim().toLowerCase();
    const bookmarkedIdx = new Set(_bookmarks.map((b) => b.logIdx));
    const html = _log.map((entry, idx) => _renderLogEntry(entry, idx, bookmarkedIdx.has(idx), searchQ)).filter(Boolean).join('');
    scroll.innerHTML = html || `<div class="story-scroll-empty">The story begins now…</div>`;
    // Wire bookmark buttons
    scroll.querySelectorAll('[data-bookmark-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _toggleBookmark(parseInt(btn.getAttribute('data-bookmark-idx'), 10));
      });
    });
    // Auto-scroll to bottom UNLESS we're in the middle of a search
    if (!searchQ) scroll.scrollTop = scroll.scrollHeight;
  }

  function _highlightMatches(text, query) {
    if (!query) return _esc(text || '');
    const esc = _esc(text || '');
    // Case-insensitive replace preserving case of original
    const qEsc = _esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return esc.replace(new RegExp(qEsc, 'gi'), (m) => `<mark class="story-search-hit">${m}</mark>`);
  }

  function _renderLogEntry(entry, idx, isBookmarked, searchQ) {
    if (!entry) return '';
    if (entry.kind === 'story') {
      // Resolve the chapter TITLE from the blueprint so the log entry shows
      // "Chapter N: <title>" rather than just "Chapter N", which used to
      // visually blur into the scene name and read like a chapter title.
      let chapterBadge = '';
      if (typeof entry.chapter === 'number') {
        const bp = _state && _state.storyBlueprint;
        const chList = bp && bp.chapters && Array.isArray(bp.chapters.list) ? bp.chapters.list : [];
        const chObj = chList.find((c) => c.number === entry.chapter);
        const chTitle = chObj && chObj.title ? chObj.title : '';
        chapterBadge = `<div class="story-entry-chapter">Chapter ${entry.chapter}${chTitle ? ` · ${_esc(chTitle)}` : ''}</div>`;
      }
      const sceneLabel = entry.scene ? `<div class="story-entry-scene"><span class="story-entry-scene-prefix">Scene:</span> ${_esc(entry.scene)}</div>` : '';
      const bookmarkBtn = `<button class="story-entry-bookmark ${isBookmarked ? 'story-entry-bookmark-active' : ''}" data-bookmark-idx="${idx}" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark this section'}">🔖</button>`;
      const highlighted = searchQ
        ? _highlightMatches(entry.text || '', searchQ)
        : _esc(entry.text || '');
      const proseHtml = highlighted.replace(/\n\n+/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>');
      return `<div class="story-entry story-entry-story" data-log-idx="${idx}">
        <div class="story-entry-story-header">
          ${chapterBadge}
          ${sceneLabel}
          ${bookmarkBtn}
        </div>
        <div class="story-entry-prose">${proseHtml}</div>
      </div>`;
    }
    if (entry.kind === 'choice-offered') {
      const list = (entry.choices || []).map((c) => `<li>${_esc(typeof c === 'string' ? c : (c.text || ''))}</li>`).join('');
      return `<div class="story-entry story-entry-choice-offered">
        <div class="story-entry-tag">CHOICES OFFERED</div>
        <ul>${list}</ul>
      </div>`;
    }
    if (entry.kind === 'choice-taken') {
      return `<div class="story-entry story-entry-player">
        <div class="story-entry-tag">YOU CHOSE</div>
        <div class="story-entry-player-body">→ ${_esc(entry.choice || '')}</div>
      </div>`;
    }
    if (entry.kind === 'freeform') {
      return `<div class="story-entry story-entry-player">
        <div class="story-entry-tag">YOUR ACTION</div>
        <div class="story-entry-player-body">→ ${_esc(entry.text || '')}</div>
      </div>`;
    }
    if (entry.kind === 'continue') {
      return `<div class="story-entry story-entry-player story-entry-continue">
        <div class="story-entry-tag">→ continue</div>
      </div>`;
    }
    if (entry.kind === 'nudge') {
      return `<div class="story-entry story-entry-nudge">
        <div class="story-entry-tag">🎯 YOU NUDGED THE STORYTELLER</div>
        <div class="story-entry-player-body">${_esc(entry.text || '')}</div>
      </div>`;
    }
    if (entry.kind === 'correction') {
      return `<div class="story-entry story-entry-system">
        <div class="story-entry-tag">CORRECTION APPLIED</div>
        <div class="story-entry-player-body">${_esc(entry.text || '')}</div>
      </div>`;
    }
    if (entry.kind === 'system') {
      return `<div class="story-entry story-entry-system">
        <div class="story-entry-player-body">${_esc(entry.text || '')}</div>
      </div>`;
    }
    return '';
  }

  function _appendOptimistic(opts) {
    // Show the player's action immediately so they see it in the scroll
    // while the Storyteller thinks. This entry is NOT authoritative — the
    // next _refreshScroll() will replace it with server truth.
    const scroll = $('story-scroll');
    if (!scroll) return;
    let html = '';
    if (opts.kind === 'choice') {
      html = `<div class="story-entry story-entry-player story-entry-optimistic">
        <div class="story-entry-tag">YOU CHOSE</div>
        <div class="story-entry-player-body">→ ${_esc(opts.input || '')}</div>
      </div>`;
    } else if (opts.kind === 'freeform') {
      html = `<div class="story-entry story-entry-player story-entry-optimistic">
        <div class="story-entry-tag">YOUR ACTION</div>
        <div class="story-entry-player-body">→ ${_esc(opts.input || '')}</div>
      </div>`;
    } else if (opts.kind === 'continue') {
      html = `<div class="story-entry story-entry-player story-entry-continue story-entry-optimistic">
        <div class="story-entry-tag">→ continue</div>
      </div>`;
    }
    scroll.insertAdjacentHTML('beforeend', html);
    scroll.scrollTop = scroll.scrollHeight;
  }

  function _appendErrorEntry(msg, rawPreview) {
    const scroll = $('story-scroll');
    if (!scroll) return;
    const preview = rawPreview ? `<div class="story-entry-error-raw">Raw preview: <code>${_esc(rawPreview)}</code></div>` : '';
    scroll.insertAdjacentHTML('beforeend', `
      <div class="story-entry story-entry-error">
        <div class="story-entry-tag">STORYTELLER ERROR</div>
        <div class="story-entry-player-body">${_esc(msg)}</div>
        ${preview}
        <div class="story-entry-error-hint">Try SEND again, press CONTINUE, or hit RETRY to undo.</div>
      </div>
    `);
    scroll.scrollTop = scroll.scrollHeight;
  }

  // ── Rendering: choices (vertical list inside the sidebar) ────────────
  function _refreshChoices() {
    const box  = $('story-choices');
    const list = $('story-choices-list');
    if (!box || !list) return;
    const choices = _state && Array.isArray(_state.pendingChoices) ? _state.pendingChoices : null;
    if (!choices || choices.length === 0) {
      box.classList.add('hidden');
      list.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    list.innerHTML = choices.map((c, i) => {
      const text = typeof c === 'string' ? c : (c.text || '');
      return `
        <button class="story-choice-btn" data-idx="${i}">
          <span class="story-choice-num">${i + 1}</span>
          <span class="story-choice-text">${_esc(text)}</span>
        </button>
      `;
    }).join('');
    list.querySelectorAll('.story-choice-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const text = typeof choices[i] === 'string' ? choices[i] : (choices[i].text || '');
        _sendChoice(text, i);
      });
    });
  }

  // ── Busy overlay ─────────────────────────────────────────────────────
  function _showBusy(label) {
    $('story-busy-label').textContent = label || 'Working…';
    $('story-overlay-busy').classList.remove('hidden');
  }
  function _hideBusy() { $('story-overlay-busy').classList.add('hidden'); }

  // ── Overlay helper ───────────────────────────────────────────────────
  function _showOverlay(id, show) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('hidden', !show);
  }

  // ── Utility ──────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.TextStory = { init, toggle };
})();
