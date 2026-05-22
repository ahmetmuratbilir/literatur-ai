const STATUS_PRECEDENCE = {
  ok: 0,
  warn: 1,
  failed: 2,
};

const SEVERITY_PRECEDENCE = {
  low: 0,
  medium: 1,
  high: 2,
};

export function resolveStatus(status) {
  if (status === 'ok' || status === 'warn' || status === 'failed') return status;
  return 'failed';
}

export function resolveSeverity(severity) {
  if (severity === 'low' || severity === 'medium' || severity === 'high') return severity;
  return 'low';
}

export function createStageResult({
  source,
  status = 'ok',
  severity = 'low',
  findings = [],
  metrics = {},
  durationMs = 0,
  errorCode = null,
}) {
  return {
    source,
    status: resolveStatus(status),
    severity: resolveSeverity(severity),
    findings: Array.isArray(findings) ? findings : [],
    metrics: metrics && typeof metrics === 'object' ? metrics : {},
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0,
    errorCode: typeof errorCode === 'string' ? errorCode : null,
  };
}

export function createFailedStageResult({
  source,
  errorCode = 'UNKNOWN_STAGE_ERROR',
  durationMs = 0,
  findings = [],
}) {
  return createStageResult({
    source,
    status: 'failed',
    severity: 'high',
    findings,
    metrics: {},
    durationMs,
    errorCode,
  });
}

export function aggregateStatus(stages = []) {
  let max = 'ok';
  for (const stage of stages) {
    const current = resolveStatus(stage?.status);
    if (STATUS_PRECEDENCE[current] > STATUS_PRECEDENCE[max]) {
      max = current;
    }
  }
  return max;
}

export function aggregateSeverity(stages = []) {
  let max = 'low';
  for (const stage of stages) {
    const current = resolveSeverity(stage?.severity);
    if (SEVERITY_PRECEDENCE[current] > SEVERITY_PRECEDENCE[max]) {
      max = current;
    }
  }
  return max;
}

