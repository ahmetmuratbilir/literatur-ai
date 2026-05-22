import { createFailedStageResult, createStageResult } from './stageResult.js';

const SOURCE = 'citationCompliance';

const DOI_CORE_RE = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
const REF_HEADING_RE = /^##\s*(kullan[ıi]lan kaynaklar|kaynak[çc]a|references|bibliography)\s*$/im;

function splitBodyAndReferences(text) {
  const raw = typeof text === 'string' ? text : '';
  const match = REF_HEADING_RE.exec(raw);
  if (!match) {
    return { body: raw, references: '' };
  }
  const index = match.index;
  return {
    body: raw.slice(0, index),
    references: raw.slice(index),
  };
}

function extractReferenceLines(referencesText) {
  return referencesText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^##\s+/i.test(line));
}

function detectReferenceStyle(bodyText, referenceLines) {
  const ieeeInTextMatches = bodyText.match(/\[(\d+(?:\s*,\s*\d+)*)\]/g) || [];
  const authorYearMatches = bodyText.match(/\([^)]+(?:19|20)\d{2}[a-z]?[^)]*\)/gi) || [];
  const ieeeRefMatches = referenceLines.filter((line) => /^\[\d+\]|^\d+[.)]\s/.test(line));

  const ieeeSignal = ieeeInTextMatches.length + ieeeRefMatches.length;
  const authorYearSignal = authorYearMatches.length;

  if (ieeeSignal === 0 && authorYearSignal === 0) {
    return { style: 'unknown', confidence: 'low' };
  }
  if (ieeeSignal > 0 && authorYearSignal > 0 && Math.abs(ieeeSignal - authorYearSignal) <= 2) {
    return { style: 'mixed', confidence: 'medium' };
  }
  if (ieeeSignal > authorYearSignal) {
    return { style: 'ieee', confidence: ieeeSignal >= authorYearSignal * 2 ? 'high' : 'medium' };
  }
  return { style: 'apa', confidence: authorYearSignal >= ieeeSignal * 2 ? 'high' : 'medium' };
}

function extractInTextIeeeNumbers(bodyText) {
  const numbers = new Set();
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let m;
  while ((m = re.exec(bodyText)) !== null) {
    for (const n of m[1].split(',')) {
      const v = Number.parseInt(n.trim(), 10);
      if (Number.isFinite(v)) numbers.add(v);
    }
  }
  return numbers;
}

function extractReferenceNumbers(referenceLines) {
  const numbers = new Set();
  referenceLines.forEach((line, idx) => {
    const m = line.match(/^\[(\d+)\]|^(\d+)[.)]\s/);
    if (m) {
      const value = Number.parseInt(m[1] || m[2], 10);
      if (Number.isFinite(value)) numbers.add(value);
    } else {
      numbers.add(idx + 1);
    }
  });
  return numbers;
}

function extractAuthorYearKeysFromInText(bodyText) {
  const keys = new Set();
  const re = /\(([^)]*(?:19|20)\d{2}[a-z]?[^)]*)\)/gi;
  let m;
  while ((m = re.exec(bodyText)) !== null) {
    const segments = m[1].split(';').map((s) => s.trim());
    for (const segment of segments) {
      const token = segment.match(/([A-ZÇĞİÖŞÜA-Za-zÇĞİÖŞÜçğıöşü'`-]+)[^0-9]*(\d{4}[a-z]?)/);
      if (!token) continue;
      keys.add(`${token[1].toLowerCase()}-${token[2].toLowerCase()}`);
    }
  }
  return keys;
}

function extractAuthorYearKeysFromReferences(referenceLines) {
  const keys = new Set();
  for (const line of referenceLines) {
    const token = line.match(/^([A-ZÇĞİÖŞÜA-Za-zÇĞİÖŞÜçğıöşü'`-]+).*?((?:19|20)\d{2}[a-z]?)/);
    if (!token) continue;
    keys.add(`${token[1].toLowerCase()}-${token[2].toLowerCase()}`);
  }
  return keys;
}

function isValidDoiToken(token) {
  if (!token) return false;
  const cleaned = token.replace(/[),.;]+$/, '');
  if (/^https?:\/\//i.test(cleaned)) {
    if (/^https?:\/\/dx\.doi\.org\//i.test(cleaned)) return false;
    if (!/^https?:\/\/doi\.org\//i.test(cleaned)) return false;
    const core = cleaned.replace(/^https?:\/\/doi\.org\//i, '');
    return DOI_CORE_RE.test(core);
  }
  return DOI_CORE_RE.test(cleaned);
}

function computeMaxSeverity(findings) {
  if (findings.some((f) => f.severity === 'high')) return 'high';
  if (findings.some((f) => f.severity === 'medium')) return 'medium';
  return 'low';
}

export function runCitationCompliance(text) {
  const startedAt = Date.now();
  try {
    const { body, references } = splitBodyAndReferences(text);
    const referenceLines = extractReferenceLines(references);
    const style = detectReferenceStyle(body, referenceLines);
    const findings = [];

    let orphanInTextCount = 0;
    let orphanReferenceCount = 0;

    if (style.style === 'ieee') {
      const inTextNumbers = extractInTextIeeeNumbers(body);
      const referenceNumbers = extractReferenceNumbers(referenceLines);

      for (const n of inTextNumbers) {
        if (!referenceNumbers.has(n)) orphanInTextCount += 1;
      }
      for (const n of referenceNumbers) {
        if (!inTextNumbers.has(n)) orphanReferenceCount += 1;
      }
    } else if (style.style === 'apa' || style.style === 'mixed') {
      const inTextKeys = extractAuthorYearKeysFromInText(body);
      const refKeys = extractAuthorYearKeysFromReferences(referenceLines);

      for (const key of inTextKeys) {
        if (!refKeys.has(key)) orphanInTextCount += 1;
      }
      for (const key of refKeys) {
        if (!inTextKeys.has(key)) orphanReferenceCount += 1;
      }
    }

    if (orphanInTextCount > 0) {
      findings.push({
        code: 'ORPHAN_IN_TEXT_CITATION',
        severity: orphanInTextCount > 3 ? 'high' : 'medium',
        message: `${orphanInTextCount} metin içi atıfın kaynakçada karşılığı bulunamadı.`,
      });
    }

    if (orphanReferenceCount > 0) {
      findings.push({
        code: 'ORPHAN_REFERENCE_ENTRY',
        severity: orphanReferenceCount > 3 ? 'medium' : 'low',
        message: `${orphanReferenceCount} kaynakça girdisi metin içinde hiç kullanılmamış görünüyor.`,
      });
    }

    const doiTokens = [];
    const doiRe = /(https?:\/\/(?:dx\.)?doi\.org\/[^\s)]+|10\.\d{4,9}\/[^\s),.;]+)/gi;
    for (const line of referenceLines) {
      const matches = line.match(doiRe) || [];
      doiTokens.push(...matches);
    }

    const invalidDoiTokens = doiTokens.filter((token) => !isValidDoiToken(token));
    if (invalidDoiTokens.length > 0) {
      findings.push({
        code: 'DOI_FORMAT_INVALID',
        severity: 'medium',
        message: `${invalidDoiTokens.length} DOI girdisi geçersiz formatta görünüyor.`,
        samples: invalidDoiTokens.slice(0, 3),
      });
    }

    if (referenceLines.length === 0) {
      findings.push({
        code: 'REFERENCE_SECTION_MISSING',
        severity: 'high',
        message: 'Kaynakça bölümü algılanamadı veya boş görünüyor.',
      });
    }

    const durationMs = Date.now() - startedAt;
    const status = findings.length === 0 ? 'ok' : 'warn';
    const severity = computeMaxSeverity(findings);

    return createStageResult({
      source: SOURCE,
      status,
      severity,
      findings,
      metrics: {
        referenceStyleDetected: style.style,
        styleConfidence: style.confidence,
        inTextCitationCount: (body.match(/\[[0-9,\s]+\]|\([^)]+(?:19|20)\d{2}[a-z]?[^)]*\)/g) || []).length,
        referenceEntryCount: referenceLines.length,
        orphanInTextCount,
        orphanReferenceCount,
        doiCount: doiTokens.length,
        invalidDoiCount: invalidDoiTokens.length,
      },
      durationMs,
    });
  } catch (error) {
    return createFailedStageResult({
      source: SOURCE,
      durationMs: Date.now() - startedAt,
      errorCode: 'CITATION_COMPLIANCE_EXCEPTION',
      findings: [
        {
          code: 'CITATION_COMPLIANCE_EXCEPTION',
          severity: 'high',
          message: error?.message || 'Citation compliance stage failed.',
        },
      ],
    });
  }
}

