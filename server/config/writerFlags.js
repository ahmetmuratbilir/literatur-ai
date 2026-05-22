const GATE_MODES = new Set(['off', 'warn_only', 'block_high']);

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function envGateMode(name, fallback = 'warn_only') {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim().toLowerCase();
  if (!GATE_MODES.has(value)) return fallback;
  return value;
}

export function getWriterFlags() {
  return {
    postcheckEnabled: envBool('WRITER_POSTCHECK_ENABLED', false),
    citationCheckEnabled: envBool('WRITER_CITATION_CHECK_ENABLED', false),
    qualityCheckEnabled: envBool('WRITER_QUALITY_CHECK_ENABLED', false),
    revisionCoachEnabled: envBool('WRITER_REVISION_COACH_ENABLED', false),
    gateMode: envGateMode('WRITER_GATE_MODE', 'warn_only'),
  };
}

export function getGateModes() {
  return Array.from(GATE_MODES);
}

