/**
 * Teslim öncesi denetim kuralları (WO-010 Aşama 2.1).
 *
 * Saf modül: belgenin özetinden (Workspace `onSnapshot`) ve geri çekme
 * cevabından madde listesi üretir. DOM, ağ, depolama yok — WO-006 deseni.
 *
 * Dürüstlük sınırları (tüzük 2.8):
 * - Yalnız elimizdeki veriyle konuşur. "Doğrulanmamış iddia" demez, "atıf
 *   işareti olmayan iddia cümlesi" der: pasaj doğrulaması yok (WO-005).
 * - Kurum kuralı iddiası yok. Sayfa düzeni maddesi seçili ayarı söyler,
 *   "İTÜ'ye uygun" demez.
 * - Skor ya da yüzde yok. Önem derecesine göre sayı var.
 * - Geri çekme durumu bilinmeyen kaynak "temiz" sayılmaz, ayrı madde olur.
 */

import { findCitations, isReferencesHeading } from '../components/workspace/references.js';
import { firstSurname } from '../components/workspace/citation.js';
import { MARK, fold } from '../components/workspace/claimDetection.js';

export const SEVERITY = ['critical', 'warning', 'info'];

/** Doğrudan alıntı: tırnak içinde en az 12 karakter (birkaç kelime). */
const QUOTE_RE = /[“"«]([^”"»]{12,})[”"»]/u;
/** Sayfa işareti: "s. 45", "ss. 12-14", "p. 3", "pp. 3–5". */
const PAGE_RE = /\b(?:s|ss|sf|p|pp)\.\s*\d/iu;
/** Kelime hedefinin altında/üstünde sayılma eşikleri. */
const UNDER = 0.5;
const OVER = 1.5;

const normDoi = (doi) => String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();

const excerpt = (text, max = 160) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * Sepetteki atıf yapılan kaynakların DOI'leri: Denetim geri çekme durumunu
 * bunlar için canlı sorar (CLAUDE.md 3.4: önbelleğe alınmaz).
 */
export function citedDois(snapshot) {
  const papers = snapshot?.papers || [];
  const cited = snapshot?.match?.cited || [];
  return [...new Set(cited.map((i) => normDoi(papers[i]?.doi)).filter(Boolean))];
}

/**
 * @param {object} snapshot Workspace özeti: { sentences, blocks, outline,
 *   refs, match, papers, setup }
 * @param {{ retractions?: Record<string, {status: string}> | null, retractionFailed?: boolean }} [options]
 * @returns {Array<{ id: string, rule: string, severity: string, params: object,
 *   target: object|null, excerpt?: string }>}
 */
export function runAudit(snapshot, { retractions = null, retractionFailed = false } = {}) {
  if (!snapshot) return [];
  const papers = snapshot.papers || [];
  const match = snapshot.match || { cited: [], uncited: [], orphans: [] };
  const sentences = snapshot.sentences || [];
  const blocks = snapshot.blocks || [];
  const headings = snapshot.outline?.headings || [];
  const refs = snapshot.refs || { present: false, lines: [] };
  const items = [];
  const add = (item) => items.push({ params: {}, target: null, ...item, id: `${item.rule}:${items.length}` });

  // --- Kritik ---------------------------------------------------------

  // Geri çekilmiş ya da endişe bildirimi almış kaynağa atıf.
  for (const i of match.cited) {
    const paper = papers[i];
    const status = retractions?.[normDoi(paper?.doi)]?.status;
    if (status === 'retracted' || status === 'concern') {
      add({ rule: status === 'retracted' ? 'retracted' : 'concern', severity: 'critical', params: { title: paper.title || '' }, target: { kind: 'bib' } });
    }
  }

  // Sepette karşılığı olmayan atıf: kaynakçaya girmeyecek.
  for (const raw of match.orphans || []) {
    const sentence = sentences.find((s) => s.text.includes(raw));
    add({
      rule: 'orphan',
      severity: 'critical',
      params: { citation: raw },
      target: sentence ? { kind: 'sentence', key: sentence.key } : null,
      excerpt: sentence ? excerpt(sentence.text) : undefined,
    });
  }

  // Kaynakça: atıf var ama bölüm yok; ya da bölüm var ama atıf yapılan kaynak içinde yok.
  if (match.cited.length > 0 && !refs.present) {
    add({ rule: 'noReferences', severity: 'critical', params: { n: match.cited.length }, target: { kind: 'bib' } });
  } else if (refs.present) {
    const body = fold(refs.lines.join('\n'));
    for (const i of match.cited) {
      const paper = papers[i];
      const surname = fold(firstSurname(paper) || '');
      const year = String(paper?.year || '').slice(0, 4);
      if (!surname) continue;
      if (!body.includes(surname) || (year && !body.includes(year))) {
        add({ rule: 'notInReferences', severity: 'critical', params: { title: paper.title || '' }, target: { kind: 'bib' } });
      }
    }
  }

  // --- Uyarı ----------------------------------------------------------

  // Atıf işareti olmayan iddia cümlesi. "Doğrulanmamış" değil: doğrulama yok.
  for (const s of sentences) {
    if (s.mark !== MARK.uncited) continue;
    add({ rule: 'uncitedClaim', severity: 'warning', target: { kind: 'sentence', key: s.key }, excerpt: excerpt(s.text) });
  }

  // Doğrudan alıntıda sayfa numarası yok (APA 7: doğrudan alıntı sayfa ister).
  for (const b of blocks) {
    const quote = b.text.match(QUOTE_RE);
    const isQuote = Boolean(quote) || b.tag === 'BLOCKQUOTE';
    if (!isQuote || findCitations(b.text).length === 0 || PAGE_RE.test(b.text)) continue;
    add({
      rule: 'quoteNoPage',
      severity: 'warning',
      target: b.key ? { kind: 'sentence', key: b.key } : null,
      excerpt: excerpt(quote ? quote[0] : b.text),
    });
  }

  // Başlığı var, altında hiç metin yok. Kaynakça bölümü bu kurala girmez:
  // onu "Kaynakçayı belgeye yaz" doldurur, boş olması ayrı bir maddedir.
  for (const h of headings) {
    if (h.total > 0 || isReferencesHeading(h.text)) continue;
    add({ rule: 'emptySection', severity: 'warning', params: { name: h.text || '—' }, target: { kind: 'section', index: h.index } });
  }

  // --- Bilgi ----------------------------------------------------------

  for (const h of headings) {
    if (!h.target || h.total === 0) continue;
    if (h.total < h.target * UNDER) {
      add({ rule: 'underTarget', severity: 'info', params: { name: h.text, n: h.total, target: h.target }, target: { kind: 'section', index: h.index } });
    } else if (h.total > h.target * OVER) {
      add({ rule: 'overTarget', severity: 'info', params: { name: h.text, n: h.total, target: h.target }, target: { kind: 'section', index: h.index } });
    }
  }

  if ((match.uncited || []).length > 0) {
    add({
      rule: 'uncitedSources',
      severity: 'info',
      params: { n: match.uncited.length, titles: match.uncited.map((i) => papers[i]?.title || '').filter(Boolean) },
      target: { kind: 'sources' },
    });
  }

  // Durumu bilinmeyen kaynak "temiz" değildir.
  const dois = citedDois(snapshot);
  const unknown = retractionFailed
    ? dois.length
    : dois.filter((d) => retractions && (!retractions[d] || retractions[d].status === 'unknown')).length;
  if (dois.length > 0 && (retractionFailed || unknown > 0)) {
    add({ rule: 'retractionUnknown', severity: 'info', params: { n: unknown }, target: { kind: 'bib' } });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Önem derecesine göre sayılar — üst özetin "3 kritik · 5 uyarı · 2 bilgi"si. */
export function countBySeverity(items) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const item of items) counts[item.severity] += 1;
  return counts;
}
