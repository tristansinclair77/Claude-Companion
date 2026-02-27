// Global hotkey registration via Electron globalShortcut.
// Default: F2 toggles microphone recording.
// Hotkey is exclusive — captured system-wide while app runs.

const { globalShortcut } = require('electron');

const DEFAULT_HOTKEY = 'F2';

class HotkeyManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.hotkey = DEFAULT_HOTKEY;
    this.registered = false;
  }

  register(hotkey = DEFAULT_HOTKEY) {
    this.unregister();
    this.hotkey = hotkey;

    const success = globalShortcut.register(hotkey, () => {
      this._onHotkey();
    });

    if (!success) {
      console.warn(`[HotkeyManager] Failed to register ${hotkey} — may be taken by another app`);
    } else {
      this.registered = true;
      console.log(`[HotkeyManager] Registered global hotkey: ${hotkey}`);
    }

    return success;
  }

  unregister() {
    if (this.registered && this.hotkey) {
      globalShortcut.unregister(this.hotkey);
      this.registered = false;
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.registered = false;
  }

  _onHotkey() {
    const win = this.mainWindow;
    if (!win) return;

    // Bring window to front if minimized or hidden
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();

    // Send mic toggle event to renderer
    win.webContents.send('hotkey:mic-toggle');
  }
}

module.exports = HotkeyManager;
