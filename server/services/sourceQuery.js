/**
 * Kaynak basina sorgu cevirici.
 *
 * KURAL (kullanici karari, 30 Eyl 2026): arama HER ZAMAN INGILIZCE yapilir.
 * Kullanici Turkce yazdiysa cevirisi, Ingilizce yazdiysa kendisi kullanilir.
 * Ozgun Turkce metin plan icinde (`phrase.original`) korunuyor; DergiPark
 * eklendiginde yalnizca o kaynak icin kullanilacak.
 *
 * Neden: Turkce + Ingilizce karisik sorgu olculebilir sekilde zarar veriyordu.
 *   DOAJ  kelime torbasi (3 TR + 3 EN)  -> 0 sonuc (AND semantigi)
 *   arXiv Turkce terimleri yok sayiyor  -> havuz degismiyor, sadece gurultu
 *   Skorlama: Turkce token'lar hicbir Ingilizce basligla eslesmiyor ve
 *   benzerlik oraninin paydasini sisiriyordu (tam eslesen baslik bile tam
 *   puan alamiyordu); tam ifade bonusu hic tetiklenmiyordu.
 *
 * IKI TUR IFADE:
 *   duz     : { original, translated }           — konu ve anahtar kelimeler
 *   boolean : { original, boolean: true }        — AI analizinin urettigi sorgu,
 *             or. ("nuclear reactor" OR "fission reactor") AND safety
 *
 * M0 REGRESYONU (duzeltildi): ilk surum boolean sorguyu da duz ifade gibi
 * paketliyordu: tirnaklari silip tamamini tek bir tirnakli diziye ceviriyordu.
 * Olculen: DOAJ 791 -> 0, OpenAlex -> 0. "AI ile analiz et" yolu M0'dan beri
 * OpenAlex/DOAJ/arXiv'den sonuc alamiyordu. Artik boolean sorgu ayristiriliyor.
 */

/** ASCII disi karakter var mi. (Artik dil tespiti icin KULLANILMIYOR: "yapay zeka" ASCII'dir.) */
export function isAsciiOnly(text) {
  return !/[^\x20-\x7e]/.test(String(text ?? ''));
}

/** Tirnak ve sorgu dilini bozan karakterleri temizler. */
function sanitizePhrase(text) {
  return String(text ?? '')
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bir ifadenin arama metni: ceviri varsa o, yoksa ozgun hali (zaten Ingilizce). */
export function searchText(phrase) {
  return sanitizePhrase(phrase?.translated || phrase?.original);
}

/**
 * Tam ifade (tirnak) yalnizca kisa ifadelerde. Uzun bir konuyu birebir ifade
 * olarak aramak ("deep learning based fault detection in nuclear power
 * plants") neredeyse hic sonuc dondurmez; uzun ifadeler kelime kelime aranir
 * ve konu disi sonuclari alaka esigi (relevanceGate) eler.
 */
const MAX_EXACT_PHRASE_WORDS = 4;
const isShortPhrase = (text) => text.split(' ').filter(Boolean).length <= MAX_EXACT_PHRASE_WORDS;

/**
 * arXiv bu kelimeleri dizinlemiyor; AND ile baglaninca sorgu bos donuyor.
 * Olculen (5 Eki 2026): "large language models higher education" 299 sonuc,
 * araya "all:in" eklenince 0. Dort test aramasinin dordunde de arXiv bu yuzden
 * sessizce 0 donduruyordu (hata degil, SOURCE_ZERO).
 */
const ARXIV_STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with']);
// arXiv tam ifadeyi birebir ariyor: "small modular reactor" 18 sonuc,
// "small modular reactor safety" 0. Diger kaynaklardan daha kisa tutuluyor.
const ARXIV_MAX_EXACT_PHRASE_WORDS = 3;

// --- Boolean sorgu ayristirici -------------------------------------------

/**
 * AI sorgusunu parcalara ayirir: ( ) AND OR NOT "ifade" kelime.
 * Operatorler yalnizca BUYUK harfle taninir; kucuk harfli "and" bir kelimedir.
 */
export function tokenizeBoolean(query) {
  const s = String(query ?? '');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '(' || ch === ')') { tokens.push({ type: ch }); i++; continue; }
    if (ch === '"') {
      const end = s.indexOf('"', i + 1);
      const text = sanitizePhrase(end === -1 ? s.slice(i + 1) : s.slice(i + 1, end));
      if (text) tokens.push({ type: 'phrase', text });
      i = end === -1 ? s.length : end + 1;
      continue;
    }
    let j = i;
    while (j < s.length && !/[\s()"]/.test(s[j])) j++;
    const word = s.slice(i, j);
    i = j;
    if (word === 'AND' || word === 'OR' || word === 'NOT') tokens.push({ type: word });
    else {
      const clean = word.replace(/[^\p{L}\p{N}\-*]/gu, '');
      if (clean) tokens.push({ type: 'word', text: clean });
    }
  }
  return tokens;
}

const isOperand = (t) => t.type === 'phrase' || t.type === 'word';

/** Parantezler dengeli ve en az bir terim var mi. */
export function isWellFormed(tokens) {
  let depth = 0;
  for (const t of tokens) {
    if (t.type === '(') depth++;
    if (t.type === ')') depth--;
    if (depth < 0) return false;
  }
  return depth === 0 && tokens.some(isOperand);
}

/** Yan yana iki terim arasina acik AND koyar (kaynaklarin varsayilani farkli). */
function withExplicitAnd(tokens) {
  const out = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    const prevEndsTerm = prev && (isOperand(prev) || prev.type === ')');
    const startsTerm = isOperand(t) || t.type === '(' || t.type === 'NOT';
    if (prevEndsTerm && startsTerm) out.push({ type: 'AND' });
    out.push(t);
  }
  return out;
}

function serialize(tokens, mapOperand) {
  return tokens
    .map((t) => (isOperand(t) ? mapOperand(t) : t.type))
    .join(' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

/** arXiv: her terime alan oneki; NOT -> ANDNOT. */
function toArxiv(tokens) {
  const out = [];
  for (const t of withExplicitAnd(tokens)) {
    if (t.type === 'NOT') {
      if (out[out.length - 1]?.type === 'AND') out.pop();
      out.push({ type: 'ANDNOT' });
      continue;
    }
    out.push(t);
  }
  return serialize(out, (t) => (t.type === 'phrase' ? `all:"${t.text}"` : `all:${t.text}`));
}

/** Operatorsuz duz metin (S2, Crossref, skorlama). NOT'lanan terimler dahil edilmez. */
function toPlain(tokens) {
  const words = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isOperand(t)) continue;
    if (tokens[i - 1]?.type === 'NOT') continue;
    words.push(t.text);
  }
  return words.join(' ');
}

// --- Ifade -> kaynak sorgusu ---------------------------------------------

/**
 * @param {'boolean'|'arxiv'|'plain'} target
 *   boolean: OpenAlex, CORE, DOAJ (hepsi AND/OR/"..." anliyor)
 */
function phraseFor(phrase, target) {
  if (phrase?.boolean) {
    const tokens = tokenizeBoolean(phrase.original);
    if (isWellFormed(tokens)) {
      if (target === 'plain') return toPlain(tokens);
      if (target === 'arxiv') return `(${toArxiv(tokens)})`;
      return `(${serialize(withExplicitAnd(tokens), (t) => (t.type === 'phrase' ? `"${t.text}"` : t.text))})`;
    }
    // Bozuk boolean (dengesiz parantez vb.): terimleri AYRI kelimeler olarak
    // ara. Tam ifade gibi tirnaklamak birbirinden bagimsiz terimleri tek bir
    // ifadeye kaynatir.
    const plain = toPlain(tokens) || sanitizePhrase(phrase.original);
    return phraseFor({ original: plain, loose: true }, target);
  }

  const text = searchText(phrase);
  if (!text) return '';
  if (target === 'plain') return text;
  const exact = !phrase.loose && isShortPhrase(text);
  if (target === 'arxiv') {
    const words = text.split(' ').map((w) => w.replace(/[^\p{L}\p{N}\-]/gu, '')).filter(Boolean);
    if (!phrase.loose && words.length <= ARXIV_MAX_EXACT_PHRASE_WORDS) return `all:"${text}"`;
    const terms = words.filter((w) => !ARXIV_STOPWORDS.has(w.toLowerCase()));
    if (terms.length === 0) return '';
    return `(${terms.map((w) => `all:${w}`).join(' AND ')})`;
  }
  return exact ? `"${text}"` : `(${text})`;
}

function combine(plan, target, joiner) {
  const parts = (plan?.phrases || []).map((p) => phraseFor(p, target)).filter(Boolean);
  return parts.join(joiner);
}

/** DOAJ — Elasticsearch query_string; AND/OR/tirnak destekli, joker/regex kapali. */
export const forDoaj = (plan) => combine(plan, 'boolean', ' AND ');
/** OpenAlex ve CORE — ayni boolean dil. */
export const forOpenAlex = (plan) => combine(plan, 'boolean', ' AND ');
/** arXiv — alan onekli; bos donerse kaynak atlanir. */
export const forArxiv = (plan) => combine(plan, 'arxiv', ' AND ');
/** Semantic Scholar — /paper/search bool operatoru desteklemiyor, duz metin. */
export const forSemanticScholar = (plan) => combine(plan, 'plain', ' ');
/** Crossref — kelime torbasi + alaka siralamasi. */
export const forCrossref = (plan) => combine(plan, 'plain', ' ');

/**
 * Skorlama icin Ingilizce metin ve ifadeler. search.js'in keyCount, benzerlik,
 * alaka skoru ve alaka esigi bunlardan hesaplanir; karisik dilli metinden degil.
 */
export function scoringInput(plan) {
  const phrases = (plan?.phrases || []).map((p) => phraseFor(p, 'plain')).filter(Boolean);
  return { text: phrases.join(' '), phrases, clauses: queryClauses(plan) };
}

/** Ustten sarilmis tek parantez ciftini soyar: ( a OR b ) -> a OR b */
function stripOuterParens(tokens) {
  let ts = tokens;
  while (ts.length >= 2 && ts[0].type === '(' && ts[ts.length - 1].type === ')') {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < ts.length - 1; i++) {
      if (ts[i].type === '(') depth++;
      if (ts[i].type === ')') depth--;
      if (depth === 0) { wrapsAll = false; break; }
    }
    if (!wrapsAll) break;
    ts = ts.slice(1, -1);
  }
  return ts;
}

/** Ust seviyede (parantez disinda) bir operatore gore boler. */
function splitTopLevel(tokens, op) {
  const parts = [[]];
  let depth = 0;
  for (const t of tokens) {
    if (t.type === '(') depth++;
    if (t.type === ')') depth--;
    if (depth === 0 && t.type === op) { parts.push([]); continue; }
    parts[parts.length - 1].push(t);
  }
  return parts.filter((p) => p.length > 0);
}

/**
 * Alaka esigi icin sorgunun AND yapisi: her clause bir AND grubu, her grup
 * bir veya daha fazla OR alternatifi (duz metin). Makale HER gruptan en az bir
 * alternatifi karsilamali.
 *
 * NEDEN: esik yalnizca "6 kelimeden 3'u" diye sayinca, AI sorgusu
 * ("nuclear reactor" OR "fission reactor") AND (safety OR "risk assessment")
 * icin canlida "Mechanistic Interpretability of LoRA-Adapted Language Models"
 * 1. siraya cikti: "safety risk assessment" 3 kelimeyi tutturdu, "nuclear
 * reactor" hic gecmedi. AND yapisini saymak bunu eler.
 *
 * Duz ifadeler (konu, anahtar kelimeler) birer tek alternatifli gruptur.
 * NOT gruplari esige girmez (dislama burada uygulanmiyor).
 *
 * @returns {string[][]}
 */
export function queryClauses(plan) {
  const clauses = [];
  for (const phrase of plan?.phrases || []) {
    if (phrase?.boolean) {
      const tokens = tokenizeBoolean(phrase.original);
      if (isWellFormed(tokens)) {
        for (const clause of splitTopLevel(withExplicitAnd(tokens), 'AND')) {
          if (clause[0]?.type === 'NOT') continue;
          const alternatives = splitTopLevel(stripOuterParens(clause), 'OR')
            .map((alt) => toPlain(stripOuterParens(alt)))
            .filter(Boolean);
          if (alternatives.length) clauses.push(alternatives);
        }
        continue;
      }
    }
    const text = phraseFor(phrase, 'plain');
    if (!text) continue;
    // Cevrilmis ifadede ozgun metin de gecerli bir alternatif: Turkce
    // kaynaklardan (OpenAlex language:tr) gelen "yapay zeka" basligi
    // "artificial intelligence" icermedigi icin esikte eleniyordu.
    const original = phrase?.translated ? sanitizePhrase(phrase.original) : '';
    clauses.push(original && original.toLowerCase() !== text.toLowerCase() ? [text, original] : [text]);
  }
  return clauses;
}

// Turkce disi Latin harfleri: Almanca/Fransizca/Ispanyolca bir sorgu
// cevrildi diye Turkce kaynaklarda aranmasin.
const NON_TURKISH_LETTERS = /[äßàâáéèêëíîïóôõúûùœæñãåø]/i;

/**
 * Turkce kaynaklar icin sorgu: kullanicinin YAZDIGI Turkce metin.
 * Kural: her kaynak en yaygin dilinde aranir. Uluslararasi kaynaklar
 * Ingilizce ceviriyle, Turkce kaynaklar ozgun Turkce metinle.
 * Hicbir ifade cevrilmediyse (sorgu zaten Ingilizce) null: ek arama yok.
 */
export function forTurkishSources(plan) {
  const phrases = (plan?.phrases || []).filter((p) => !p.boolean);
  const translated = phrases.some((p) => p.translated && sanitizePhrase(p.translated).toLowerCase() !== sanitizePhrase(p.original).toLowerCase());
  if (!translated) return null;
  const text = phrases.map((p) => sanitizePhrase(p.original)).filter(Boolean).join(' ');
  if (!text || NON_TURKISH_LETTERS.test(text)) return null;
  return text;
}

/** Tum kaynaklarin sorgularini tek seferde uretir. */
export function buildSourceQueries(plan) {
  return {
    doaj: forDoaj(plan),
    arxiv: forArxiv(plan),
    semanticScholar: forSemanticScholar(plan),
    crossref: forCrossref(plan),
    openAlex: forOpenAlex(plan),
  };
}
