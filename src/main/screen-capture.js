// Screen capture using Electron's desktopCapturer API.
// Called from the main process via IPC.

const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Captures the primary display as a PNG and saves it to temp directory.
 * @returns {Promise<{path: string, size: number, timestamp: number}>}
 */
async function captureScreen() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  if (!sources || sources.length === 0) {
    throw new Error('No screen sources found for capture');
  }

  const primaryScreen = sources[0];
  const screenshot = primaryScreen.thumbnail.toPNG();
  const timestamp = Date.now();
  const tempPath = path.join(os.tmpdir(), `companion-screenshot-${timestamp}.png`);

  fs.writeFileSync(tempPath, screenshot);

  return {
    path: tempPath,
    size: screenshot.length,
    timestamp,
  };
}

/**
 * Deletes a screenshot file from temp after it's been used.
 */
function cleanupScreenshot(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

module.exports = { captureScreen, cleanupScreenshot };
