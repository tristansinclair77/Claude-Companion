// Feature Requests — persistent storage for Aria's self-queued feature ideas.
// Stored in characters/<name>/feature-requests.json.

const fs   = require('fs');
const path = require('path');

const FILENAME = 'feature-requests.json';
const NOTIFY_FILENAME = 'feature-requests-deleted.json'; // deletion notifications pending injection

/**
 * Returns the full path to the requests file for a character directory.
 * @param {string} characterDir
 */
function _reqPath(characterDir) {
  return path.join(characterDir, FILENAME);
}

function _notifyPath(characterDir) {
  return path.join(characterDir, NOTIFY_FILENAME);
}

/**
 * Loads the current request list. Returns [] if file doesn't exist.
 * @param {string} characterDir
 * @returns {Array<{id, title, description, addedAt}>}
 */
function loadRequests(characterDir) {
  try {
    const p = _reqPath(characterDir);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Saves the request list to disk.
 * @param {string} characterDir
 * @param {Array}  requests
 */
function saveRequests(characterDir, requests) {
  fs.writeFileSync(_reqPath(characterDir), JSON.stringify(requests, null, 2), 'utf8');
}

/**
 * Appends a new request to the list. Returns the saved request object.
 * @param {string} characterDir
 * @param {{title: string, description: string}} request
 * @returns {{id, title, description, addedAt}}
 */
function addRequest(characterDir, { title, description }) {
  const requests = loadRequests(characterDir);
  const entry = {
    id:          Date.now().toString(),
    title:       title.trim(),
    description: description.trim(),
    addedAt:     new Date().toISOString(),
  };
  requests.push(entry);
  saveRequests(characterDir, requests);
  return entry;
}

/**
 * Removes a request by id. Saves a deletion notification for injection into the next prompt.
 * @param {string} characterDir
 * @param {string} id
 * @returns {{deleted: object|null, remaining: Array}}
 */
function deleteRequest(characterDir, id) {
  const requests = loadRequests(characterDir);
  const idx      = requests.findIndex((r) => r.id === id);
  const deleted  = idx !== -1 ? requests.splice(idx, 1)[0] : null;
  saveRequests(characterDir, requests);

  if (deleted) {
    // Record notification so it can be injected once into the next system prompt
    const notifications = loadPendingDeletionNotifications(characterDir);
    notifications.push({ title: deleted.title, deletedAt: new Date().toISOString() });
    fs.writeFileSync(_notifyPath(characterDir), JSON.stringify(notifications, null, 2), 'utf8');
  }

  return { deleted, remaining: requests };
}

/**
 * Returns pending deletion notifications (titles the user removed).
 * These get injected once into the next system prompt, then cleared.
 * @param {string} characterDir
 * @returns {Array<{title, deletedAt}>}
 */
function loadPendingDeletionNotifications(characterDir) {
  try {
    const p = _notifyPath(characterDir);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Clears all pending deletion notifications (call after injecting into prompt).
 * @param {string} characterDir
 */
function clearDeletionNotifications(characterDir) {
  try {
    const p = _notifyPath(characterDir);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

module.exports = {
  loadRequests,
  saveRequests,
  addRequest,
  deleteRequest,
  loadPendingDeletionNotifications,
  clearDeletionNotifications,
};
