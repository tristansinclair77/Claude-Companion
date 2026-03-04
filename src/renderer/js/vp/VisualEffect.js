'use strict';
/**
 * VisualEffect — base class for all Visual Package canvas / DOM effects.
 *
 * Each effect is a self-contained module that manages its own canvas or DOM
 * elements. Effects register themselves with PackageRegistry at load time and
 * are started/stopped by BackgroundSettings when the active package changes or
 * the user toggles a module.
 *
 * Subclasses must override:
 *   _onStart(config)         — activate the effect with the given config object
 *   _onStop()                — deactivate and clean up (cancel rAF, clear canvas, etc.)
 *
 * Subclasses may optionally override:
 *   _onUpdate(key, value)    — handle a live config change without a full restart.
 *                              Default behaviour is stop + restart, which is safe
 *                              but loses any smooth transition the effect might have.
 *
 * Public API used by settings.js:
 *   effect.start(config)     — start or restart with a new config
 *   effect.stop()            — stop (idempotent)
 *   effect.update(key, val)  — change one config value while running
 *   effect.running           — boolean getter
 */
class VisualEffect {

  /**
   * @param {string} id — unique identifier; must match the key used in
   *                      PackageRegistry.registerEffect() and effectModules arrays.
   */
  constructor(id) {
    this.id       = id;
    this._running = false;
    this._config  = {};
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Activate the effect with the given config. Safe to call on an already-running effect. */
  start(config = {}) {
    this._config  = { ...config };
    this._running = true;
    this._onStart(this._config);
  }

  /** Deactivate the effect. Idempotent — safe to call when already stopped. */
  stop() {
    if (!this._running) return;
    this._running = false;
    this._onStop();
  }

  /**
   * Update a single config key while the effect is running.
   * Calls _onUpdate so subclasses can handle smoothly (e.g. crossfade).
   * If the effect is not running, only updates the stored config.
   */
  update(key, value) {
    this._config[key] = value;
    if (this._running) this._onUpdate(key, value);
  }

  /** Whether the effect is currently active. */
  get running() { return this._running; }

  // ── Subclass hooks ─────────────────────────────────────────────────────────

  /** Override: activate the effect. config is a copy of this._config. */
  _onStart(config) {}

  /** Override: deactivate the effect and clean up all resources. */
  _onStop() {}

  /**
   * Override: handle a live config change.
   * Default: full stop + restart (safe but loses smooth transitions).
   * Subclasses with crossfade/interpolation should override this.
   */
  _onUpdate(key, value) {
    this.stop();
    this.start(this._config);
  }
}
