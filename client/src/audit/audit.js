/**
 * Denetim kuralları (WO-010 Aşama 2.1; WO-011 Faz 3'te yazar modunun
 * Kontrol sekmesine ve "Teslime hazırla" akışına taşındı).
 *
 * Saf modül: belgenin özetinden ve geri çekme cevabından madde listesi
 * üretir. DOM, ağ, depolama yok — WO-006 deseni.
 *
 * İki aşama (`stage`): yazarken canlı Kontrol `draft`, teslim kontrolü
 * `submit`. Fark yalnız boş bölümün önemi: taslakta Bilgi, teslimde
 * zorunlu bölüm için Uyarı (isteğe bağlı tez bölümleri Bilgi kalır).
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

/**
 * Tez şablonunda isteğe bağlı sayılan bölümler: enstitüye göre değişir
 * (şablonun rehber satırları da "istiyorsa" der). Boş kalmaları teslimde de
 * yalnız Bilgi'dir. Kimlik `data-template-section`'dan gelir.
 */
export const OPTIONAL_SECTIONS = new Set(['abbreviations', 'tableList', 'figureList', 'appendix', 'cv']);

/** Tez teslim paketinin kontrol listesi (şartname Faz 3); belgedeki gerçek bölümlerden. */
export const THESIS_PACKAGE = ['cover', 'approval', 'ethics', 'ozet', 'abstract', 'contents', 'tableList', 'figureList', 'appendix'];

// Tablo ve şekil başlıkları: blok başında "Tablo 2." / "Şekil 3:" / "Table 1 –".
const CAPTION_RE = /^(tablo|table|şekil|sekil|figure|fig\.)\s*(\d+)\s*[.:–—-]/iu;
// Metin içi gönderme: "Tablo 2'de", "(bkz. Şekil 3)", "Figure 1 shows".
const MENTION_RE = /(?<![\p{L}\p{N}])(tablo|table|şekil|sekil|figure|fig\.)\s*(\d+)(?![\p{N}])/giu;
const captionKind = (word) => (/^(tablo|table)$/i.test(word) ? 'table' : 'figure');

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
export function runAudit(snapshot, { retractions = null, retractionFailed = false, stage = 'submit' } = {}) {
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

  // Kaynakta künye eksik: kaynakça satırı eksik çıkar. Atıf yapılan kaynakta
  // Uyarı, yalnız sepette duranda Bilgi. Yılı olmayan kaynak "(Ad, t.y.)" ile
  // anılır ve atıf eşleştirici yıl beklediği için "atıf yapılan" sayılmaz;
  // bu yüzden sepetin tamamına bakılır.
  const citedSet = new Set(match.cited);
  for (const [i, paper] of papers.entries()) {
    const fields = [];
    if (!firstSurname(paper)) fields.push('author');
    if (!String(paper?.year || '').trim()) fields.push('year');
    if (!String(paper?.title || '').trim()) fields.push('title');
    if (fields.length) {
      add({ rule: 'incompleteSource', severity: citedSet.has(i) ? 'warning' : 'info', params: { title: paper?.title || paper?.doi || '—', fields }, target: { kind: 'sources' } });
    }
  }

  // Tablo ve şekil numaralandırması: sıra atlıyor ya da tekrar ediyor;
  // metinde gönderme yapılan numaranın başlığı yok.
  const captions = { table: [], figure: [] };
  const captionBlocks = new Set();
  for (const b of blocks) {
    const m = b.text.match(CAPTION_RE);
    if (!m) continue;
    captions[captionKind(m[1])].push({ n: Number(m[2]), key: b.key, text: b.text });
    captionBlocks.add(b);
  }
  for (const kind of ['table', 'figure']) {
    const list = captions[kind];
    list.forEach((c, i) => {
      if (c.n !== i + 1) {
        add({ rule: 'captionOrder', severity: 'warning', params: { kind, n: c.n, expected: i + 1 }, target: c.key ? { kind: 'sentence', key: c.key } : null, excerpt: excerpt(c.text, 80) });
      }
    });
    const have = new Set(list.map((c) => c.n));
    const reported = new Set();
    for (const b of blocks) {
      if (captionBlocks.has(b)) continue;
      for (const m of b.text.matchAll(MENTION_RE)) {
        const n = Number(m[2]);
        if (captionKind(m[1]) !== kind || have.has(n) || reported.has(n)) continue;
        reported.add(n);
        add({ rule: 'captionMissing', severity: 'warning', params: { kind, n }, target: b.key ? { kind: 'sentence', key: b.key } : null, excerpt: excerpt(b.text) });
      }
    }
  }

  // Başlığı var, altında hiç metin yok. Kaynakça bölümü bu kurala girmez:
  // onu "Kaynakçayı belgeye yaz" doldurur, boş olması ayrı bir maddedir.
  // Taslakta Bilgi; teslimde zorunlu bölüm Uyarı, isteğe bağlı bölüm Bilgi.
  for (const h of headings) {
    if (h.total > 0 || isReferencesHeading(h.text)) continue;
    const optional = OPTIONAL_SECTIONS.has(h.key);
    const severity = stage === 'draft' || optional ? 'info' : 'warning';
    add({ rule: 'emptySection', severity, params: { name: h.text || '—', optional }, target: { kind: 'section', index: h.index } });
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

/**
 * Aynı önem derecesinde aynı kuraldan birden fazla madde tek grupta
 * toplanır ("5 bölüm boş" → açılınca liste). Sıra korunur.
 * @returns {Array<{ id: string, rule: string, severity: string, items: object[] }>}
 */
export function groupItems(items) {
  const groups = [];
  const byKey = new Map();
  for (const item of items) {
    const key = `${item.severity}:${item.rule}`;
    let group = byKey.get(key);
    if (!group) {
      group = { id: key, rule: item.rule, severity: item.severity, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * Tez teslim paketi: her bileşen belgede var mı, başlığı var ama boş mu,
 * yok mu. Belgedeki başlıklardan hesaplanır; kimlik (`key`) yoksa ad ile.
 * @param {Array<{key?: string|null, text: string, total: number, index: number}>} headings
 * @param {(key: string) => string} nameOf bölümün görünen adı
 */
export function packageStatus(headings, nameOf) {
  const norm = (s) => String(s || '').trim().toLocaleLowerCase('tr');
  return THESIS_PACKAGE.map((key) => {
    const h = headings.find((x) => x.key === key) || headings.find((x) => norm(x.text) === norm(nameOf(key)));
    if (!h) return { key, status: 'missing', index: null };
    return { key, status: h.total > 0 ? 'present' : 'empty', index: h.index };
  });
}

/** Önem derecesine göre sayılar — üst özetin "3 hata · 5 uyarı · 2 bilgi"si. */
export function countBySeverity(items) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const item of items) counts[item.severity] += 1;
  return counts;
}
