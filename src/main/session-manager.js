// Manages conversation sessions and rolling message window.
// Each Claude call is a FRESH session (no --resume) — full context injected every time.

const { CONVERSATION_WINDOW_SIZE, SUMMARIZE_CHUNK_SIZE } = require('../shared/constants');

class SessionManager {
  constructor() {
    // Current conversation window (last N messages, verbatim)
    this.messageWindow = [];

    // Master summary: compressed history of ALL past sessions
    this.masterSummary = '';

    // Permanent memories injected into every Claude call
    // (loaded from DB at startup, updated as memories are extracted)
    this.permanentMemories = [];

    // User profile summary string
    this.userProfile = '';

    // Current session record (will be saved to DB on session end)
    this.currentSession = {
      startedAt: new Date().toISOString(),
      messageCount: 0,
    };
  }

  /**
   * Adds a message to the rolling window.
   * @param {'user' | 'companion'} role
   * @param {string} content
   * @param {string} [emotion]
   */
  addMessage(role, content, emotion = 'neutral') {
    this.messageWindow.push({ role, content, emotion, timestamp: Date.now() });
    this.currentSession.messageCount++;
  }

  /**
   * Returns the current message window.
   */
  getWindow() {
    return [...this.messageWindow];
  }

  /**
   * Returns the last N messages for display.
   */
  getRecentMessages(n = CONVERSATION_WINDOW_SIZE) {
    return this.messageWindow.slice(-n);
  }

  /**
   * Checks if summarization is needed and returns the chunk to summarize.
   * Returns null if no summarization needed yet.
   * @returns {{ chunk: Array, remaining: Array } | null}
   */
  checkForSummarization() {
    if (this.messageWindow.length > CONVERSATION_WINDOW_SIZE) {
      const chunk = this.messageWindow.slice(0, SUMMARIZE_CHUNK_SIZE);
      const remaining = this.messageWindow.slice(SUMMARIZE_CHUNK_SIZE);
      return { chunk, remaining };
    }
    return null;
  }

  /**
   * Applies a summarization result: shrinks the window and updates master summary.
   * @param {string} summaryText - Summary of the chunk
   * @param {Array} remaining - Remaining messages after summarization
   */
  applySummarization(summaryText, remaining) {
    this.messageWindow = remaining;
    if (this.masterSummary) {
      this.masterSummary += ' ' + summaryText;
    } else {
      this.masterSummary = summaryText;
    }
  }

  /**
   * Updates the master summary (e.g., after re-compression).
   */
  setMasterSummary(summary) {
    this.masterSummary = summary;
  }

  /**
   * Loads state from DB on startup.
   */
  loadFromDB(data) {
    if (data.masterSummary) this.masterSummary = data.masterSummary;
    if (data.permanentMemories) this.permanentMemories = data.permanentMemories;
    if (data.userProfile) this.userProfile = data.userProfile;
    if (data.recentMessages && data.recentMessages.length > 0) {
      this.messageWindow = data.recentMessages;
    }
  }

  /**
   * Adds a permanent memory.
   */
  addMemory(category, content, source = 'auto_detected') {
    this.permanentMemories.push({ category, content, source });
  }

  /**
   * Returns session context for building a Claude prompt.
   */
  getContextForPrompt() {
    return {
      masterSummary: this.masterSummary,
      permanentMemories: this.permanentMemories,
      userProfile: this.userProfile,
      conversationWindow: this.getRecentMessages(),
    };
  }

  /**
   * Resets the window for a new session (keeps master summary and memories).
   */
  startNewSession() {
    this.messageWindow = [];
    this.currentSession = {
      startedAt: new Date().toISOString(),
      messageCount: 0,
    };
  }
}

module.exports = SessionManager;
