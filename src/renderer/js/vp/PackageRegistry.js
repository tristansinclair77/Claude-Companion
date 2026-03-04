'use strict';
/**
 * PackageRegistry — central registry for all Visual Packages and Visual Effects.
 *
 * Packages and effects register themselves at script-load time by calling
 * PackageRegistry.registerPackage() / PackageRegistry.registerEffect() at the
 * bottom of their respective files.
 *
 * BackgroundSettings calls PackageRegistry.getPackageConfigs() instead of
 * referencing a hardcoded array, so new packages are picked up automatically
 * just by adding their <script> tag to index.html.
 */
const PackageRegistry = (() => {

  // Insertion-ordered maps so packages appear in the selector in load order.
  const _packages = new Map();  // id → VisualPackage instance
  const _effects  = new Map();  // id → VisualEffect instance

  // ── Registration ───────────────────────────────────────────────────────────

  function registerPackage(pkg) {
    if (!(pkg instanceof VisualPackage)) {
      console.error('[PackageRegistry] registerPackage: argument must extend VisualPackage', pkg);
      return;
    }
    if (!pkg.id) {
      console.error('[PackageRegistry] registerPackage: package is missing an id', pkg);
      return;
    }
    _packages.set(pkg.id, pkg);
    console.log(`[PackageRegistry] registered package: ${pkg.id}`);
  }

  function registerEffect(effect) {
    if (!(effect instanceof VisualEffect)) {
      console.error('[PackageRegistry] registerEffect: argument must extend VisualEffect', effect);
      return;
    }
    if (!effect.id) {
      console.error('[PackageRegistry] registerEffect: effect is missing an id', effect);
      return;
    }
    _effects.set(effect.id, effect);
    console.log(`[PackageRegistry] registered effect: ${effect.id}`);
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  /** Get a VisualEffect instance by id, or null if not registered. */
  function getEffect(id) {
    return _effects.get(id) || null;
  }

  /** Get a VisualPackage instance by id, or null if not registered. */
  function getPackage(id) {
    return _packages.get(id) || null;
  }

  /** IDs of all registered packages, in registration order. */
  function getPackageIds() {
    return [..._packages.keys()];
  }

  /**
   * Returns all packages as plain config objects (via VisualPackage.toConfig()),
   * merging any previously-saved effect state from the provided Map.
   *
   * @param {Map<string, Object>} savedEffectsMap — map of packageId → saved effects object
   * @returns {Object[]}
   */
  function getPackageConfigs(savedEffectsMap = new Map()) {
    return [..._packages.values()].map(pkg =>
      pkg.toConfig(savedEffectsMap.get(pkg.id) || {}));
  }

  return { registerPackage, registerEffect, getEffect, getPackage, getPackageIds, getPackageConfigs };

})();
