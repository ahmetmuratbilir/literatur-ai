import { aggregateSeverity, aggregateStatus } from './stageResult.js';

export function buildPostcheck({
  gateMode = 'warn_only',
  citationReport = null,
  qualityReport = null,
  gateReport = null,
  durationMs = 0,
}) {
  const stages = [citationReport, qualityReport, gateReport].filter(Boolean);

  return {
    status: aggregateStatus(stages),
    severity: aggregateSeverity(stages),
    gateMode,
    citationReport: citationReport || null,
    qualityReport: qualityReport || null,
    gateReport: gateReport || null,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0,
    version: 'v1',
  };
}

