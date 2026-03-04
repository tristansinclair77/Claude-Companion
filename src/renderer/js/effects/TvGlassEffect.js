'use strict';
/**
 * TvGlassEffect — CRT / TV glass surface overlay.
 * Extends VisualEffect. Registered with PackageRegistry under id 'tvGlass'.
 *
 * Simulates viewing the UI through a CRT monitor's curved glass:
 *   - Vignette: edge-darkening that suggests curved glass pulling away from you
 *   - Corner crush: extra darkness in each corner (pronounced CRT curvature)
 *   - Primary glare: large diffuse specular highlight (upper-left)
 *   - Secondary specular: tight bright hotspot inside the primary
 *   - Rim lights: subtle top + left edge glow (glass bezel reflection)
 *   - Drift: all glare positions shift imperceptibly slowly (~30-60s full cycle)
 *
 * Canvas sits at z-index: 15 — above arcade border (z:1), below title bar (z:100).
 * pointer-events: none so it never blocks clicks.
 */
class TvGlassEffect extends VisualEffect {

  constructor() {
    super('tvGlass');
    this._canvas = null;
    this._ctx    = null;
    this._rAF    = null;
    this._driftT = 0;
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config) {
    if (!this._initCanvas()) return;
    this._driftT = 0;
    this._tick();
  }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-tv-glass');
    if (!this._canvas) return false;
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    return true;
  }

  _resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    ctx.clearRect(0, 0, W, H);

    // ── Vignette — curved-glass edge darkening ────────────────────────────
    const vg = ctx.createRadialGradient(
      W * 0.5, H * 0.48, Math.min(W, H) * 0.20,
      W * 0.5, H * 0.48, Math.max(W, H) * 0.72
    );
    vg.addColorStop(0,    'rgba(0,0,0,0)');
    vg.addColorStop(0.52, 'rgba(0,0,0,0)');
    vg.addColorStop(0.78, 'rgba(0,0,0,0.08)');
    vg.addColorStop(1,    'rgba(0,0,0,0.44)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ── Corner crush — deeper darkness in each corner (CRT curvature) ─────
    const cornerRadius = Math.min(W, H) * 0.40;
    for (const [cx, cy] of [[0,0],[W,0],[0,H],[W,H]]) {
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerRadius);
      cg.addColorStop(0,    'rgba(0,0,0,0.30)');
      cg.addColorStop(0.45, 'rgba(0,0,0,0.09)');
      cg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Primary glare — large diffuse specular highlight ──────────────────
    const gx = 0.27 + Math.sin(this._driftT * 0.52) * 0.015;
    const gy = 0.13 + Math.cos(this._driftT * 0.78) * 0.008;
    const g1 = ctx.createRadialGradient(W * gx, H * gy, 0, W * gx, H * gy, W * 0.54);
    g1.addColorStop(0,    'rgba(255,255,255,0.044)');
    g1.addColorStop(0.22, 'rgba(255,255,245,0.024)');
    g1.addColorStop(0.55, 'rgba(255,255,220,0.007)');
    g1.addColorStop(1,    'rgba(255,255,200,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // ── Secondary specular — tight bright hotspot inside the primary ──────
    const sx = (gx - 0.055) + Math.sin(this._driftT * 0.38) * 0.009;
    const sy = (gy - 0.030) + Math.cos(this._driftT * 0.60) * 0.005;
    const g2 = ctx.createRadialGradient(W * sx, H * sy, 0, W * sx, H * sy, W * 0.14);
    g2.addColorStop(0,    'rgba(255,255,255,0.082)');
    g2.addColorStop(0.28, 'rgba(255,255,245,0.030)');
    g2.addColorStop(1,    'rgba(255,255,200,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // ── Top edge rim light — glass bezel rim reflection ───────────────────
    const te = ctx.createLinearGradient(0, 0, 0, H * 0.034);
    te.addColorStop(0, 'rgba(255,255,255,0.058)');
    te.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = te;
    ctx.fillRect(0, 0, W, H * 0.034);

    // ── Left edge rim light ───────────────────────────────────────────────
    const le = ctx.createLinearGradient(0, 0, W * 0.016, 0);
    le.addColorStop(0, 'rgba(255,255,255,0.048)');
    le.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = le;
    ctx.fillRect(0, 0, W * 0.016, H);
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  _tick() {
    if (!this._running || !this._canvas) { this._rAF = null; return; }
    this._driftT += 0.00032;   // full glare drift cycle ≈ 30–60s
    this._draw();
    this._rAF = requestAnimationFrame(() => this._tick());
  }
}

PackageRegistry.registerEffect(new TvGlassEffect());
