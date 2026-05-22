import { createFailedStageResult, createStageResult } from './stageResult.js';

const SOURCE = 'revisionCoach';

function normalizeReviewerText(input) {
  const raw = typeof input === 'string' ? input : '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[\u00ad\u200b]/g, '')
    .replace(/[•●▪◦‣]/g, '- ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLine(line) {
  return line
    .replace(/^[\-\*\u2022]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

function detectSectionHint(line) {
  const lower = line.toLowerCase();
  if (/(major|major revision|critical|fundamental flaw)/i.test(lower)) return 'major';
  if (/(minor|suggestion|consider)/i.test(lower)) return 'minor';
  if (/(editorial|grammar|typo|format)/i.test(lower)) return 'editorial';
  if (/(positive|strength|good job|well done)/i.test(lower)) return 'positive';
  return null;
}

function classifyComment(text, sectionHint = null) {
  if (sectionHint) return sectionHint;
  const lower = text.toLowerCase();
  if (/(cannot be accepted|fundamental|fatal|critical|major revision|required)/i.test(lower)) return 'major';
  if (/(minor|consider|could be improved|helpful to)/i.test(lower)) return 'minor';
  if (/(typo|grammar|punctuation|format|style issue)/i.test(lower)) return 'editorial';
  if (/(good|strong|interesting|well done|valuable)/i.test(lower)) return 'positive';
  return 'minor';
}

function mapPriority(type) {
  if (type === 'major') return 'P1';
  if (type === 'minor') return 'P2';
  if (type === 'editorial') return 'P3';
  return 'P3';
}

function splitComments(normalizedText) {
  if (!normalizedText) return [];
  const lines = normalizedText.split('\n');
  const comments = [];

  let sectionHint = null;
  let paragraphBuffer = [];

  const flushParagraph = () => {
    const paragraph = paragraphBuffer.join(' ').trim();
    if (paragraph.length > 0) {
      comments.push({ raw: paragraph, sectionHint });
    }
    paragraphBuffer = [];
  };

  for (const originalLine of lines) {
    const line = originalLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const newHint = detectSectionHint(line);
    if (newHint) {
      flushParagraph();
      sectionHint = newHint;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const cleaned = normalizeLine(line);
      if (cleaned) comments.push({ raw: cleaned, sectionHint });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return comments;
}

export function runRevisionCoach(rawReviewerText) {
  const startedAt = Date.now();
  try {
    const normalized = normalizeReviewerText(rawReviewerText);
    if (!normalized) {
      const stageResult = createStageResult({
        source: SOURCE,
        status: 'warn',
        severity: 'medium',
        findings: [
          {
            code: 'EMPTY_REVIEWER_TEXT',
            severity: 'medium',
            message: 'Reviewer metni boş veya okunamadı.',
          },
        ],
        metrics: {
          parsedCommentCount: 0,
        },
        durationMs: Date.now() - startedAt,
      });

      return {
        stageResult,
        roadmap: {
          overview: {
            totalComments: 0,
            p1Count: 0,
            p2Count: 0,
            p3Count: 0,
          },
          items: [],
        },
      };
    }

    const parsedComments = splitComments(normalized);
    const items = parsedComments.map((entry, idx) => {
      const type = classifyComment(entry.raw, entry.sectionHint);
      const priority = mapPriority(type);
      return {
        id: idx + 1,
        priority,
        type,
        summary: entry.raw,
        suggestedAction: type === 'major'
          ? 'Bu yorumu önce ele al; metodoloji/argüman tarafında somut düzeltme planı oluştur.'
          : type === 'minor'
            ? 'Ana düzeltmelerden sonra bu öneriyi uygula ve metinde netleştir.'
            : type === 'editorial'
              ? 'Dil, yazım ve format düzeltmeleri olarak son turda uygula.'
              : 'Yanıt mektubunda güçlü yön olarak kısaca belirt.',
      };
    });

    const p1Count = items.filter((i) => i.priority === 'P1').length;
    const p2Count = items.filter((i) => i.priority === 'P2').length;
    const p3Count = items.filter((i) => i.priority === 'P3').length;

    const findings = [];
    if (p1Count > 0) {
      findings.push({
        code: 'MAJOR_REVISION_ITEMS_DETECTED',
        severity: 'medium',
        message: `${p1Count} adet P1 (must-fix) yorum tespit edildi.`,
      });
    }

    const stageResult = createStageResult({
      source: SOURCE,
      status: p1Count > 0 ? 'warn' : 'ok',
      severity: p1Count > 0 ? 'medium' : 'low',
      findings,
      metrics: {
        parsedCommentCount: items.length,
        p1Count,
        p2Count,
        p3Count,
      },
      durationMs: Date.now() - startedAt,
    });

    return {
      stageResult,
      roadmap: {
        overview: {
          totalComments: items.length,
          p1Count,
          p2Count,
          p3Count,
        },
        items,
      },
    };
  } catch (error) {
    return {
      stageResult: createFailedStageResult({
        source: SOURCE,
        durationMs: Date.now() - startedAt,
        errorCode: 'REVISION_COACH_EXCEPTION',
        findings: [
          {
            code: 'REVISION_COACH_EXCEPTION',
            severity: 'high',
            message: error?.message || 'Revision coach stage failed.',
          },
        ],
      }),
      roadmap: {
        overview: {
          totalComments: 0,
          p1Count: 0,
          p2Count: 0,
          p3Count: 0,
        },
        items: [],
      },
    };
  }
}

