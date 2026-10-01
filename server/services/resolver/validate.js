/**
 * Makale çözümleyici — doğrulama: benzerlik, skor, karar ve fark raporu.
 * Hiçbir katmanın ilk sonucu doğrudan kabul edilmez; her aday buradan geçer.
 *
 * Kayıt biçimi (sources.js'in döndürdüğü kanonik kayıt):
 *   { title, authors: [{family, given, orcid}], year, venue, volume, issue, pages, … }
 */

export const FOUND_THRESHOLD = 0.85;
export const CANDIDATE_THRESHOLD = 0.65;
const WEIGHTS = { title: 0.6, author: 0.25, year: 0.15 };
// Bu kadar ya da daha az anlamlı sözcüklü girdi tek başına "bulundu" olamaz:
// "OEE" her OEE başlığının alt kümesidir ve token_set_ratio 100 verir.
const SHORT_INPUT_TOKENS = 2;
const SHORT_INPUT_CAP = 0.7;

// Soyad önekleri: "Luozzo" ↔ "Di Luozzo" eşleşir ama fark raporlanır.
const SURNAME_PREFIXES = ['di', 'de', 'da', 'del', 'della', 'van', 'von', 'der', 'den', 'el', 'al', 'le', 'la', 'du', 'dos', 'das', 'mac', 'mc', 'o'];

/** HTML etiketlerini ve temel varlıkları temizler (Crossref/OpenAlex başlıklarında <i>, <sub> olabilir). */
export function stripHtml(text) {
  return String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Karşılaştırma için katlama: Türkçe küçük harf (İ→i, I→ı), aksan silme,
 * ı→i, noktalama → boşluk. Gösterim için özgün metin ayrı tutulur.
 */
export function fold(text) {
  return stripHtml(text)
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLocaleLowerCase('tr')
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const tokens = (text) => fold(text).split(' ').filter(Boolean);

// Girdideki dolgu sözcükler ("… makalesi", "the paper on …"): kapsam
// hesabına girmez.
const FILLER = new Set(['makale', 'makalesi', 'makalesini', 'calisma', 'calismasi', 'arastirma', 'arastirmasi', 'tez', 'tezi',
  'article', 'paper', 'study', 'the', 'a', 'an', 'of', 'on', 'in', 'and', 'for', 'to', 've', 'ile', 'bir', 'bu']);
const content = (text) => tokens(text).filter((t) => !FILLER.has(t));

/**
 * Serbest metin sorgusundan dolgu sözcükleri çıkarır (özgün yazımı korur).
 * Ölçülen: OpenAlex "OEE human factor AHP article" ile hedef makaleyi
 * bulamıyor, "OEE human factor AHP" ile ilk sırada buluyor.
 */
export function stripFiller(text) {
  const kept = String(text || '').split(/\s+/).filter((w) => w && !FILLER.has(fold(w)));
  return kept.length ? kept.join(' ') : String(text || '');
}

/** Normalize Indel benzerliği (rapidfuzz `ratio`): 2·LCS / (|a|+|b|), 0-100. */
export function ratio(a, b) {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const n = a.length;
  const m = b.length;
  let prev = new Array(m + 1).fill(0);
  let cur = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return (200 * prev[m]) / (n + m);
}

/**
 * rapidfuzz `token_set_ratio`: ortak sözcükler + farklar; biri diğerinin
 * alt kümesiyse 100. Serbest metin ("Thiede 2023 energy data analytics OEE")
 * tam başlığın alt kümesi olduğu için bu ölçü seçildi.
 */
export function tokenSetRatio(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const diffAB = [...ta].filter((t) => !tb.has(t)).sort();
  const diffBA = [...tb].filter((t) => !ta.has(t)).sort();
  const sect = inter.join(' ');
  const c1 = [sect, diffAB.join(' ')].filter(Boolean).join(' ');
  const c2 = [sect, diffBA.join(' ')].filter(Boolean).join(' ');
  if (sect && (!diffAB.length || !diffBA.length)) return 100;
  return Math.max(ratio(sect, c1), ratio(sect, c2), ratio(c1, c2));
}

/**
 * Başlık benzerliği 0-1.
 * - Çok kısa girdiye tavan ("OEE" her OEE başlığının alt kümesi).
 * - Kapsam: token_set_ratio aday başlık girdinin ALT KÜMESİYKEN de 100
 *   veriyor. Uydurma "Kuantum tavuk yetiştiriciliğinde blokzincir tabanlı OEE
 *   optimizasyonu" girdisi, 2 sözcüklü gerçek "Blokzincir Optimizasyonu"
 *   başlığıyla %100 eşleşiyordu. Girdinin anlamlı sözcüklerinin yarısından
 *   azı karşılanıyorsa benzerlik kapsamla sınırlanır.
 */
export function titleSimilarity(input, candidate) {
  const words = content(input);
  let sim = tokenSetRatio(words.length ? words.join(' ') : input, candidate) / 100;
  if (words.length <= SHORT_INPUT_TOKENS) return Math.min(sim, SHORT_INPUT_CAP);
  const cand = new Set(tokens(candidate));
  const coverage = words.filter((w) => cand.has(w)).length / words.length;
  if (coverage < 0.6) sim = Math.min(sim, coverage + 0.25);
  return sim;
}

const stripPrefix = (family) => {
  const parts = fold(family).split(' ');
  while (parts.length > 1 && SURNAME_PREFIXES.includes(parts[0])) parts.shift();
  return parts.join(' ');
};

/**
 * Girdideki soyadı kaydın yazarlarından birine uyuyor mu.
 * @returns {{matched: boolean, author?: object, exact?: boolean}}
 */
export function matchSurname(surname, authors = []) {
  const s = fold(surname);
  if (!s) return { matched: false };
  for (const a of authors) {
    const fam = fold(a.family || a.literal || '');
    if (!fam) continue;
    if (fam === s) return { matched: true, author: a, exact: true };
    // "Luozzo" ↔ "Di Luozzo", "Gonzalez" ↔ "González-Pérez"? yalnız önek toleransı
    if (stripPrefix(fam) === stripPrefix(s) || fam.endsWith(` ${s}`) || s.endsWith(` ${fam}`)) {
      return { matched: true, author: a, exact: false };
    }
  }
  return { matched: false };
}

export function yearScore(inputYear, recordYear) {
  if (!inputYear || !recordYear) return null;
  const diff = Math.abs(Number(inputYear) - Number(recordYear));
  if (diff === 0) return 1;
  if (diff === 1) return 0.7; // preprint / dergi yılı farkı
  return 0;
}

/**
 * Aday skoru. Girdide yazar ya da yıl yoksa ağırlıklar mevcut alanlara
 * orantılı dağıtılır.
 * @param {{title, authorCandidates, year}} parsed parseCitation çıktısı
 */
export function scoreCandidate(parsed, record) {
  const parts = {};
  if (parsed.title) parts.title = titleSimilarity(parsed.title, record.title);
  const surnames = parsed.authorCandidates || [];
  if (surnames.length) {
    // Yapılandırılmış satırda ilk yazar; serbest metinde adaylardan herhangi biri
    const tries = parsed.structured ? surnames.slice(0, 1) : surnames;
    parts.author = tries.some((s) => matchSurname(s, record.authors).matched) ? 1 : 0;
  }
  const ys = yearScore(parsed.year, record.year);
  if (ys !== null) parts.year = ys;
  else if (parsed.year && !record.year) parts.year = 0.5; // kayıtta yıl yok: bilinmiyor

  const totalWeight = Object.keys(parts).reduce((sum, k) => sum + WEIGHTS[k], 0);
  if (totalWeight === 0) return { score: 0, parts };
  const score = Object.entries(parts).reduce((sum, [k, v]) => sum + WEIGHTS[k] * v, 0) / totalWeight;
  return { score: Math.round(score * 1000) / 1000, parts };
}

export function decide(score) {
  if (score >= FOUND_THRESHOLD) return 'found';
  if (score >= CANDIDATE_THRESHOLD) return 'candidates';
  return 'none';
}

const authorLabel = (a) => [a.family || a.literal, a.given].filter(Boolean).join(', ');

/**
 * Kaynakça satırı ile kanonik kaydı alan alan karşılaştırır. Yalnızca
 * yapılandırılmış girdide (APA/IEEE satırı) anlamlı; serbest metinde boş döner.
 */
export function findDiscrepancies(parsed, record) {
  if (!parsed?.structured || !record) return [];
  const out = [];
  const authors = record.authors || [];

  const first = parsed.authors?.[0];
  if (first) {
    const m = matchSurname(first, authors);
    if (m.matched && fold(m.author.family) !== fold(first)) {
      out.push({ field: 'author', input: first, canonical: m.author.family, note: 'surname_spelling' });
    } else if (!m.matched && authors.length) {
      out.push({ field: 'author', input: first, canonical: authorLabel(authors[0]), note: 'first_author_differs' });
    }
  }

  const etAl = /et al|vd\./i.test(parsed.raw || '');
  if (!etAl && parsed.authors && authors.length > parsed.authors.length) {
    const missing = authors.filter((a) => !parsed.authors.some((s) => matchSurname(s, [a]).matched));
    if (missing.length) {
      out.push({ field: 'authors', input: parsed.authors.join('; '), canonical: authors.map((a) => a.family || a.literal).join('; '), note: 'missing_coauthors', missing: missing.map((a) => a.family || a.literal) });
    }
  }

  if (parsed.year && record.year && Number(parsed.year) !== Number(record.year)) {
    out.push({ field: 'year', input: String(parsed.year), canonical: String(record.year), note: 'year_differs' });
  }

  if (parsed.title && record.title && titleSimilarity(parsed.title, record.title) < 0.95) {
    out.push({ field: 'title', input: parsed.title, canonical: record.title, note: 'title_differs' });
  }

  if (parsed.venue && record.venue && tokenSetRatio(parsed.venue, record.venue) < 80) {
    out.push({ field: 'venue', input: parsed.venue, canonical: record.venue, note: 'venue_differs' });
  }

  for (const field of ['volume', 'issue', 'pages']) {
    const canonical = record[field];
    if (!canonical) continue;
    const input = parsed[field];
    if (!input) out.push({ field, input: '', canonical: String(canonical), note: 'missing' });
    else if (fold(input) !== fold(canonical)) out.push({ field, input: String(input), canonical: String(canonical), note: 'differs' });
  }
  return out;
}
