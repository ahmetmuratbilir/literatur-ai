import { createFailedStageResult, createStageResult } from './stageResult.js';

const SOURCE = 'outputGate';

function maxSeverity(values) {
  const order = { low: 0, medium: 1, high: 2 };
  let current = 'low';
  for (const value of values) {
    const normalized = value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
    if (order[normalized] > order[current]) {
      current = normalized;
    }
  }
  return current;
}

export function runOutputGate({
  citationReport = null,
  qualityReport = null,
  gateMode = 'warn_only',
}) {
  const startedAt = Date.now();
  try {
    const findings = [];
    const severities = [];

    const sourceReports = [citationReport, qualityReport].filter(Boolean);
    for (const report of sourceReports) {
      if (report.status === 'failed') {
        findings.push({
          code: 'UPSTREAM_STAGE_FAILED',
          severity: 'high',
          message: `${report.source} stage failed. İçerik fail-open ile teslim ediliyor.`,
          stage: report.source,
        });
        severities.push('high');
      }
      for (const finding of report.findings || []) {
        severities.push(finding?.severity || report.severity || 'low');
      }
    }

    const severity = maxSeverity(severities);
    const shouldBlock = gateMode === 'block_high' && severity === 'high';

    if (gateMode === 'off') {
      return createStageResult({
        source: SOURCE,
        status: 'ok',
        severity: 'low',
        findings: [],
        metrics: {
          gateMode,
          shouldBlock: false,
          evaluatedFindingCount: severities.length,
        },
        durationMs: Date.now() - startedAt,
      });
    }

    const status = severity === 'low' ? 'ok' : 'warn';
    if (shouldBlock) {
      findings.push({
        code: 'HIGH_SEVERITY_GATE_RULE',
        severity: 'high',
        message: 'Gate mode block_high olduğu için yüksek riskli içerik bloklanmalı.',
      });
    }

    return createStageResult({
      source: SOURCE,
      status,
      severity,
      findings,
      metrics: {
        gateMode,
        shouldBlock,
        evaluatedFindingCount: severities.length,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return createFailedStageResult({
      source: SOURCE,
      durationMs: Date.now() - startedAt,
      errorCode: 'OUTPUT_GATE_EXCEPTION',
      findings: [
        {
          code: 'OUTPUT_GATE_EXCEPTION',
          severity: 'high',
          message: error?.message || 'Output gate stage failed.',
        },
      ],
    });
  }
}

