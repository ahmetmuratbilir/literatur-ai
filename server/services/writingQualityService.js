import { createFailedStageResult, createStageResult } from './stageResult.js';

const SOURCE = 'writingQuality';
const REF_HEADING_RE = /^##\s*(kullan[ıi]lan kaynaklar|kaynak[çc]a|references|bibliography)\s*$/im;

const THROAT_CLEARING_PATTERNS = [
  /in the realm of/i,
  /it'?s important to note that/i,
  /it is worth mentioning that/i,
  /in today'?s rapidly evolving/i,
  /this serves as a testament to/i,
  /it goes without saying that/i,
  /in order to/i,
  /it should be noted that/i,
  /when it comes to/i,
  /as a matter of fact/i,
];

function splitBody(text) {
  const raw = typeof text === 'string' ? text : '';
  const match = REF_HEADING_RE.exec(raw);
  if (!match) return raw;
  return raw.slice(0, match.index);
}

function computeMaxSeverity(findings) {
  if (findings.some((f) => f.severity === 'high')) return 'high';
  if (findings.some((f) => f.severity === 'medium')) return 'medium';
  return 'low';
}

function tokenizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function buildRepeatedPhraseRatio(words) {
  if (words.length < 4) return 0;
  const counts = new Map();
  for (let i = 0; i < words.length - 1; i += 1) {
    const key = `${words[i]} ${words[i + 1]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let repeated = 0;
  for (const value of counts.values()) {
    if (value > 1) repeated += value - 1;
  }
  const total = Math.max(1, words.length - 1);
  return repeated / total;
}

export function runWritingQualityCheck(text) {
  const startedAt = Date.now();
  try {
    const body = splitBody(text);
    const plainBody = body.replace(/[#*_`>-]/g, ' ').trim();
    const sentences = plainBody
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const sentenceWordCounts = sentences.map((s) => tokenizeWords(s).length);
    const totalWords = sentenceWordCounts.reduce((acc, n) => acc + n, 0);
    const avgSentenceLength = sentences.length > 0 ? totalWords / sentences.length : 0;
    const longSentenceThreshold = 35;
    const longSentenceCount = sentenceWordCounts.filter((n) => n > longSentenceThreshold).length;
    const longSentenceRatio = sentences.length > 0 ? longSentenceCount / sentences.length : 0;

    const words = tokenizeWords(plainBody);
    const repeatedPhraseRatio = buildRepeatedPhraseRatio(words);

    const throatClearingHits = THROAT_CLEARING_PATTERNS.reduce((acc, pattern) => {
      const matches = plainBody.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
      return acc + (matches ? matches.length : 0);
    }, 0);

    const buCalismaCount = (plainBody.match(/\bbu çalışma\b/gi) || []).length;

    const findings = [];

    if (avgSentenceLength > 30) {
      findings.push({
        code: 'AVG_SENTENCE_TOO_LONG',
        severity: avgSentenceLength > 38 ? 'high' : 'medium',
        message: `Ortalama cümle uzunluğu yüksek (${avgSentenceLength.toFixed(1)} kelime).`,
      });
    }

    if (longSentenceRatio > 0.3) {
      findings.push({
        code: 'LONG_SENTENCE_DENSITY_HIGH',
        severity: longSentenceRatio > 0.45 ? 'high' : 'medium',
        message: `Uzun cümle yoğunluğu yüksek (${(longSentenceRatio * 100).toFixed(1)}%).`,
      });
    }

    if (repeatedPhraseRatio > 0.16) {
      findings.push({
        code: 'REPEATED_PHRASE_RATIO_HIGH',
        severity: repeatedPhraseRatio > 0.24 ? 'high' : 'medium',
        message: `Tekrarlayan ifade oranı yüksek (${(repeatedPhraseRatio * 100).toFixed(1)}%).`,
      });
    }

    if (throatClearingHits > 0) {
      findings.push({
        code: 'THROAT_CLEARING_OPENERS',
        severity: throatClearingHits > 2 ? 'medium' : 'low',
        message: `${throatClearingHits} adet akademik olmayan giriş kalıbı bulundu.`,
      });
    }

    if (buCalismaCount > 3) {
      findings.push({
        code: 'BU_CALISMA_REPETITION',
        severity: buCalismaCount > 6 ? 'medium' : 'low',
        message: `"Bu çalışma" ifadesi sık tekrar ediyor (${buCalismaCount}).`,
      });
    }

    const readabilityScoreRaw = 100
      - (avgSentenceLength * 1.2)
      - (repeatedPhraseRatio * 120)
      - (longSentenceRatio * 45)
      - (throatClearingHits * 3);
    const readabilityScore = Math.max(0, Math.min(100, Math.round(readabilityScoreRaw)));

    const durationMs = Date.now() - startedAt;
    const status = findings.length === 0 ? 'ok' : 'warn';
    const severity = computeMaxSeverity(findings);

    return createStageResult({
      source: SOURCE,
      status,
      severity,
      findings,
      metrics: {
        sentenceCount: sentences.length,
        wordCount: words.length,
        avgSentenceLength: Number(avgSentenceLength.toFixed(2)),
        longSentenceCount,
        longSentenceRatio: Number(longSentenceRatio.toFixed(4)),
        repeatedPhraseRatio: Number(repeatedPhraseRatio.toFixed(4)),
        throatClearingHits,
        buCalismaCount,
        readabilityScore,
      },
      durationMs,
    });
  } catch (error) {
    return createFailedStageResult({
      source: SOURCE,
      durationMs: Date.now() - startedAt,
      errorCode: 'WRITING_QUALITY_EXCEPTION',
      findings: [
        {
          code: 'WRITING_QUALITY_EXCEPTION',
          severity: 'high',
          message: error?.message || 'Writing quality stage failed.',
        },
      ],
    });
  }
}

