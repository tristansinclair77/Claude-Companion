// Response validator for the two-phase text adventure turn.
//
// Phase 1 (calc request) and Phase 2 (narrator) each have required and
// expected fields. This module checks them and returns structured results
// used by text-adventure-ipc.js to decide whether to auto-retry and which
// phase needs to be re-run.
//
// Results are also attached to the appendDebugResponse entries so that
// characters/<name>/text-adventure-debug-responses.json has structured
// pass/fail data alongside the raw response text.

// ── Phase 1 validator ────────────────────────────────────────────────────────
//
// Phase 1 must emit exactly one of:
//   [COMBAT_CALC_REQUEST] { ...json... } [/COMBAT_CALC_REQUEST]
//   [NO_CALC_NEEDED]
//
// parseCalcRequestResponse already does this parsing and returns:
//   { kind: 'request', request: {...} }    ← explicit calc request, valid JSON
//   { kind: 'no_calc' }                    ← [NO_CALC_NEEDED] tag was present
//   { kind: 'no_calc', reason: '...' }     ← fell back (tag absent or bad JSON)
//
// A fallback no_calc is "degraded" — the engine continues because it's safe to
// assume no calc was needed, but it means the model skipped the required tag.
// We track this so the take-action handler knows Phase 1 was suspect when
// deciding whether a Phase 2 failure warrants retrying both or only Phase 2.

function validatePhase1(raw, decision) {
  if (!raw || !raw.trim()) {
    return {
      valid: false,
      degraded: false,
      fatal: ['Phase 1 returned an empty response'],
      warnings: [],
    };
  }

  if (decision.kind === 'request') {
    return { valid: true, degraded: false, fatal: [], warnings: [] };
  }

  if (decision.kind === 'no_calc' && !decision.reason) {
    // Clean [NO_CALC_NEEDED] tag was present
    return { valid: true, degraded: false, fatal: [], warnings: [] };
  }

  // Fell back — model didn't emit either required tag.
  // Not fatal (engine continues safely), but marked degraded so the
  // retry logic can note that Phase 1 was also unreliable.
  return {
    valid: false,
    degraded: true,   // degraded = fell back safely, not a hard crash
    fatal: [],
    warnings: [decision.reason || 'Phase 1 tag missing — fell back to no_calc'],
  };
}

// ── Phase 2 validator ────────────────────────────────────────────────────────
//
// FATAL (response is rejected and narrator phase is auto-retried):
//   [NARRATOR]...[/NARRATOR]   — the primary story block; without it the
//                                 terminal shows nothing and the player is stuck
//   [ARIA_EMOTION] <id>        — required every turn; drives the portrait
//
// EXPECTED (logged as warnings, play continues):
//   [SCENE] <name>             — should be present; drives the HUD scene label
//   [GAME_STATE] { } [/GAME_STATE]  — almost always needed for state continuity
//
// Note: parseAdventureResponse always populates portraitEmotion via fallback,
// so we check the raw response directly for the [ARIA_EMOTION] tag presence.

function validatePhase2(raw, parsed) {
  if (!raw || !raw.trim()) {
    return {
      valid: false,
      fatal: ['Phase 2 returned an empty response'],
      warnings: [],
    };
  }

  const fatal    = [];
  const warnings = [];

  if (!parsed.narrator) {
    fatal.push('[NARRATOR]...[/NARRATOR] block missing');
  }
  if (!/\[ARIA_EMOTION\]/i.test(raw)) {
    fatal.push('[ARIA_EMOTION] tag missing');
  }

  if (!parsed.scene) {
    warnings.push('[SCENE] tag missing');
  }
  if (!parsed.gameStateDiff) {
    warnings.push('[GAME_STATE] block missing or unparseable JSON');
  }

  // Detect the specific failure mode where the model slipped into companion
  // chat format ([DIALOGUE]/[THOUGHTS]/(emotion)) instead of GM narrator format.
  // This happens when the player's action contains dialogue directed at Aria and
  // the character's normal chat rules override the adventure directive.
  const wrongFormat =
    /\[DIALOGUE\]/i.test(raw) &&
    !parsed.narrator &&
    /\[THOUGHTS\]|\([\w_]+\)/i.test(raw);

  return {
    valid: fatal.length === 0,
    wrongFormat,
    fatal,
    warnings,
  };
}

module.exports = { validatePhase1, validatePhase2 };
