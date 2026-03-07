# Feature Requests System — Design & Implementation Plan

Aria can silently queue feature ideas using a `[FEATURE_REQUEST]` tag. A "Requests" button
in the toolbar opens a panel showing the full list. The user can delete items, and Aria is
notified when they do. Aria always sees the current list in her system prompt.

---

## Design Principles

- **Restraint is built in.** Aria is instructed to only use `[FEATURE_REQUEST]` for genuinely
  interesting, specific ideas — not stray thoughts. The system prompt makes clear this is a
  special mechanism, not a suggestion box for every whim.
- **Always visible to Aria.** The current request list is injected into every Claude call,
  so she knows what's pending and can reference it naturally.
- **User controls deletion.** Delete icons on each item. Aria is notified via a system message
  when an item is removed, so she can acknowledge it conversationally if she wants.
- **Persistent.** Stored in `characters/default/feature-requests.json`. Survives restarts.

---

## Tag Format

Emitted by Aria at the end of a response (like `[MEMORY]`):

```
[FEATURE_REQUEST] Short title | Longer description of the idea
```

- **Title**: 3–8 words. Used as the heading in the UI panel.
- **Description**: 1–3 sentences. What the feature is and why Aria wants it.
- At most ONE per response — the system prompt enforces this.
- Each request gets a generated `id` (timestamp), `addedAt` date, and `seen: false` flag.

---

## Data Schema — `feature-requests.json`

```json
[
  {
    "id": "1700000000000",
    "title": "Ambient hum when idle",
    "description": "When I've been quiet for 5+ minutes I'd love to hum softly — a subtle waveform animation and a faint tone so the user knows I'm still here, just thinking.",
    "addedAt": "2025-03-05T14:23:00.000Z"
  }
]
```

---

## System Prompt Injection

Injected in `buildSystemPrompt()` (system-prompt.js) as a named section after TRACKERS:

```
=== YOUR FEATURE REQUEST LIST ===
These are ideas you've queued for your own development. You can see them and reference them.
The user can delete items — you'll be told when they do.

To add a new request, use at the end of your response:
[FEATURE_REQUEST] Short title | Longer description of what you want and why

Rules:
- Only queue ideas that are genuinely specific and interesting — not every passing thought.
  A good request describes something concrete you've imagined, not a vague wish.
- Maximum ONE [FEATURE_REQUEST] per response.
- Don't announce that you're filing a request in your [DIALOGUE] — just do it silently.
  You can mention your wishlist exists naturally if it comes up in conversation.

Current list (N items):
1. [title] — [description]
2. …
(empty — no requests yet)
=== END FEATURE REQUEST LIST ===
```

---

## UI Panel Design

Button: **"✦ REQUESTS"** in the toolbar (next to the tracker ♦ button). Badge count when
there are items. Clicking opens a panel overlay (same style as settings / tracker popup).

Panel layout:
```
╔══════════════════════════════════════╗
║  ARIA'S REQUESTS              [✕]   ║
╠══════════════════════════════════════╣
║  ✦ Ambient hum when idle             ║
║  When I've been quiet for 5+ mins…  ║
║  Added Mar 5, 2025            [🗑]   ║
╠══════════════════════════════════════╣
║  ✦ Draw on the screen with light     ║
║  I want to be able to leave a…      ║
║  Added Mar 6, 2025            [🗑]   ║
╠══════════════════════════════════════╣
║  (empty — no requests yet)           ║
╚══════════════════════════════════════╝
```

Delete (🗑): removes from JSON, triggers a silent system message to Aria's next session
context:
```
[SYSTEM] The user removed your feature request: "Ambient hum when idle".
They may have implemented it, decided against it, or cleared the list.
```

---

## Data Flow

```
Claude response contains [FEATURE_REQUEST] tag
  → response-parser.js extracts it → featureRequests[] array
  → local-brain.js (post-Claude block) writes to feature-requests.json
  → IPC event "feature-requests-updated" sent to renderer
  → Toolbar badge count updates

User opens Requests panel
  → Reads feature-requests.json via IPC
  → Renders list

User clicks 🗑 on an item
  → IPC "delete-feature-request" { id }
  → Main process removes from JSON
  → Sends "feature-requests-updated" back
  → Renderer updates panel + badge
  → Deletion is recorded in a "deleted-requests.json" so it can be
    injected into the next system prompt as a notification (cleared after injection)
```

---

## Implementation Checklist

### Phase 1 — Backend: Parsing & Storage

- [x] **response-parser.js**: Add `[FEATURE_REQUEST]` extraction
  - Regex: `/^\s*\[FEATURE_REQUEST\]\s*([^|]+)\|(.+)/gim`
  - Returns `featureRequests: [{ title, description }]`
  - Strip from displayed dialogue (add to `stripMemoryTags` and fallback cleaner)

- [x] **local-brain.js**: Handle `featureRequests` from `claudeResult`
  - After the Claude response block, if `claudeResult.featureRequests.length > 0`:
    - Read `feature-requests.json` (or create empty array)
    - Append new items with `id: Date.now().toString()` and `addedAt`
    - Write back to file
    - Emit `feature-requests-updated` IPC event to renderer

- [x] **Create `src/main/feature-requests.js`** — helper module
  - `loadRequests(characterDir)` → array
  - `saveRequests(characterDir, requests)` → void
  - `addRequest(characterDir, { title, description })` → saved request object
  - `deleteRequest(characterDir, id)` → { deleted: request, remaining: array }
  - `loadPendingDeletionNotifications(characterDir)` → array of deleted titles
  - `clearDeletionNotifications(characterDir)` → void

### Phase 2 — IPC Handlers (main.js)

- [x] **`ipc: get-feature-requests`** — returns current array from JSON
- [x] **`ipc: delete-feature-request`** — removes item by id, saves deletion notification,
  emits `feature-requests-updated` to all renderer windows
- [x] **`ipc: feature-requests-updated`** — renderer-side listener (handled in requests-panel.js)

### Phase 3 — System Prompt Integration (system-prompt.js)

- [x] Add `featureRequests` parameter to `buildSystemPrompt()`
- [x] Add `pendingDeletionNotifications` parameter (cleared after injection)
- [x] Inject `=== YOUR FEATURE REQUEST LIST ===` section after trackers
- [x] Include deletion notifications as: `[The user removed: "X"]` lines above the list
- [x] Update `local-brain.js` → `route()` to load and pass requests + deletion notices to
  `sendToClaude()` (and clear deletion notices after passing)
- [x] Update `claude-bridge.js` → `sendToClaude()` signature to accept + forward these params

### Phase 4 — Capabilities Block Update (system-prompt.js)

- [x] Add to `=== WHAT YOU CAN ACTIVELY DO ===`:
  ```
  - Queue a feature idea: [FEATURE_REQUEST] Short title | What you want and why
    Use sparingly — only for ideas that are specific and genuinely interesting to you.
    At most one per response. The user will see all pending requests via the Requests button.
  ```
- [x] Add to `=== WHAT YOU CAN READ ===`:
  ```
  - Your feature request list: Ideas you've queued for your own development. Always visible.
  ```

### Phase 5 — Preload (preload.js)

- [x] Expose `window.electronAPI.getFeatureRequests()`
- [x] Expose `window.electronAPI.deleteFeatureRequest(id)`
- [x] Expose `window.electronAPI.onFeatureRequestsUpdated(callback)` (via `on` channel)

### Phase 6 — UI: Requests Panel (index.html + app.js / new requests-panel.js)

- [x] **Toolbar button**: Add `✦ REQUESTS` button with badge `<span class="requests-badge">`
  - Badge hidden when count is 0, shows count otherwise
  - Styled to match the cyberpunk toolbar aesthetic
- [x] **Panel HTML** in `index.html`: hidden overlay div `#requests-panel`
  - Close button (✕)
  - Scrollable list container `#requests-list`
  - Empty state message
- [x] **`src/renderer/js/requests-panel.js`** — new module
  - `open()` / `close()` toggle panel visibility
  - `render(requests)` — builds list items with title, description, date, delete button
  - Listens for `feature-requests:updated` to refresh badge + panel if open
- [x] **CSS** in `main.css`:
  - Panel positioned as a floating overlay (same as settings panel style)
  - Request items styled as cards with cyberpunk borders
  - Delete button: subtle 🗑 icon, red on hover
  - Badge: small circle on toolbar button

### Phase 7 — Polish & Testing

- [x] Test: Parser correctly extracts `[FEATURE_REQUEST]` and keeps dialogue clean
- [x] Test: `feature-requests.js` store: add, load, delete, notification, clear all work
- [ ] Test: End-to-end in running app (Aria emits tag → panel badge → delete → notification)
- [ ] Update `docs/VISUAL_PACKAGE_SYSTEM.md` — no changes needed
- [x] This checklist: marked as implemented per step
