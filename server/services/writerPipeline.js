import crypto from 'crypto';
import { getWriterFlags } from '../config/writerFlags.js';
import { logger } from '../utils/logger.js';
import { buildPostcheck } from './postcheckBuilder.js';
import { runCitationCompliance } from './citationComplianceService.js';
import { runWritingQualityCheck } from './writingQualityService.js';
import { runOutputGate } from './outputGateService.js';
import { createFailedStageResult, createStageResult } from './stageResult.js';
import { streamAcademicTextWithBridge } from './writerGenerationBridge.js';

function emitSse(res, req, payload) {
  if (req?.aborted || res.writableEnded || res.destroyed) return false;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  return true;
}

function skippedStage(source, reason) {
  return createStageResult({
    source,
    status: 'ok',
    severity: 'low',
    findings: [],
    metrics: {
      skipped: true,
      reason,
    },
    durationMs: 0,
  });
}

function runStageFailOpen({
  source,
  requestId,
  pipelineLogger,
  errorCode,
  findingsMessage,
  handler,
}) {
  const startedAt = Date.now();
  try {
    const stageResult = handler();
    pipelineLogger.info({
      requestId,
      stage: source,
      durationMs: Date.now() - startedAt,
      status: stageResult.status,
      severity: stageResult.severity,
    });
    return stageResult;
  } catch (error) {
    const failed = createFailedStageResult({
      source,
      durationMs: Date.now() - startedAt,
      errorCode,
      findings: [
        {
          code: errorCode,
          severity: 'high',
          message: findingsMessage,
        },
      ],
    });
    pipelineLogger.error({
      requestId,
      stage: source,
      durationMs: failed.durationMs,
      status: failed.status,
      severity: failed.severity,
      errorCode,
      error: error?.message || `${source} failed`,
    });
    return failed;
  }
}

function countFindings(...reports) {
  return reports.reduce((total, report) => {
    if (!Array.isArray(report?.findings)) return total;
    return total + report.findings.length;
  }, 0);
}

export function createRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

export async function runWriterPipeline({
  requestId = createRequestId(),
  safePapers,
  prompt,
  outputType,
  tone,
  length,
  language,
  bibliographyFormat = 'APA 7',
  req,
  res,
  overrides = {},
}) {
  const pipelineLogger = overrides.logger || logger;
  const flags = overrides.flags || getWriterFlags();
  const generationBridge = overrides.streamAcademicTextWithBridge || streamAcademicTextWithBridge;
  const citationService = overrides.runCitationCompliance || runCitationCompliance;
  const qualityService = overrides.runWritingQualityCheck || runWritingQualityCheck;
  const gateService = overrides.runOutputGate || runOutputGate;
  const pipelineStartedAt = Date.now();
  let generatedText = '';
  let provider = 'unknown';
  let legacyDoneEventCount = 0;

  pipelineLogger.info({
    requestId,
    stage: 'writerPipeline',
    event: 'start',
    flags,
    paperCount: safePapers?.length || 0,
  });

  try {
    const generationStartedAt = Date.now();
    const generation = await generationBridge({
      safePapers,
      prompt,
      outputType,
      tone,
      length,
      language,
      bibliographyFormat,
      req,
      onToken: (token) => {
        emitSse(res, req, { token });
      },
    });
    generatedText = generation.text || '';
    provider = generation.provider || provider;
    legacyDoneEventCount = Number.isFinite(generation.doneEventCount)
      ? generation.doneEventCount
      : Number(Boolean(generation.doneSeen));

    if (!generatedText.trim()) {
      pipelineLogger.error({
        requestId,
        stage: 'generation',
        status: 'failed',
        error: 'Generation returned empty text',
        metrics: {
          provider,
          doneSeenInLegacyStream: Boolean(generation.doneSeen),
          legacyDoneEventCount,
        },
      });
      emitSse(res, req, {
        error: 'AI servisi boş yanıt döndürdü. Lütfen tekrar deneyin.',
      });
      if (!res.writableEnded) res.end();
      return;
    }

    pipelineLogger.info({
      requestId,
      stage: 'generation',
      durationMs: Date.now() - generationStartedAt,
      status: 'ok',
      metrics: {
        provider,
        charCount: generatedText.length,
        doneSeenInLegacyStream: Boolean(generation.doneSeen),
        legacyDoneEventCount,
      },
    });
  } catch (error) {
    pipelineLogger.error({
      requestId,
      stage: 'generation',
      status: 'failed',
      error: error?.message || 'Generation failed',
    });
    emitSse(res, req, {
      error: error?.message || 'Unexpected error during AI generation.',
    });
    if (!res.writableEnded) res.end();
    return;
  }

  let citationReport = skippedStage('citationCompliance', 'postcheck_disabled');
  let qualityReport = skippedStage('writingQuality', 'postcheck_disabled');
  let gateReport = skippedStage('outputGate', 'postcheck_disabled');

  if (flags.postcheckEnabled) {
    if (flags.citationCheckEnabled) {
      citationReport = runStageFailOpen({
        source: 'citationCompliance',
        requestId,
        pipelineLogger,
        errorCode: 'CITATION_COMPLIANCE_STAGE_THROW',
        findingsMessage: 'Citation compliance check failed, continuing with fail-open.',
        handler: () => citationService(generatedText),
      });
    } else {
      citationReport = skippedStage('citationCompliance', 'flag_disabled');
    }

    if (flags.qualityCheckEnabled) {
      qualityReport = runStageFailOpen({
        source: 'writingQuality',
        requestId,
        pipelineLogger,
        errorCode: 'WRITING_QUALITY_STAGE_THROW',
        findingsMessage: 'Writing quality check failed, continuing with fail-open.',
        handler: () => qualityService(generatedText),
      });
    } else {
      qualityReport = skippedStage('writingQuality', 'flag_disabled');
    }

    gateReport = runStageFailOpen({
      source: 'outputGate',
      requestId,
      pipelineLogger,
      errorCode: 'OUTPUT_GATE_STAGE_THROW',
      findingsMessage: 'Output gate failed, continuing with fail-open.',
      handler: () => gateService({
        citationReport,
        qualityReport,
        gateMode: flags.gateMode,
      }),
    });

    pipelineLogger.info({
      requestId,
      stage: 'outputGate',
      durationMs: gateReport.durationMs,
      status: gateReport.status,
      severity: gateReport.severity,
      gateMode: flags.gateMode,
      shouldBlock: Boolean(gateReport?.metrics?.shouldBlock),
    });
  }

  const totalDurationMs = Date.now() - pipelineStartedAt;
  const postcheck = buildPostcheck({
    gateMode: flags.gateMode,
    citationReport,
    qualityReport,
    gateReport,
    durationMs: totalDurationMs,
  });

  let doneEventCount = 0;
  if (emitSse(res, req, {
    done: true,
    postcheck,
  })) {
    doneEventCount += 1;
  }
  if (!res.writableEnded) res.end();

  const warningCount = countFindings(citationReport, qualityReport, gateReport);

  pipelineLogger.info({
    requestId,
    stage: 'writerPipeline',
    event: 'done',
    durationMs: totalDurationMs,
    status: postcheck.status,
    severity: postcheck.severity,
  });

  pipelineLogger.info({
    requestId,
    stage: 'writerPipeline',
    event: 'metrics',
    provider,
    totalDurationMs,
    citationDurationMs: citationReport.durationMs,
    qualityDurationMs: qualityReport.durationMs,
    gateDurationMs: gateReport.durationMs,
    'postcheck.status': postcheck.status,
    maxSeverity: postcheck.severity,
    warningCount,
    doneEventCount,
    legacyDoneEventCount,
  });
}
