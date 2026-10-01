/**
 * Gelismis mod: kullanicinin ikili yargilarindan AHP agirliklari.
 *
 * Kullaniciya matris gosterilmez; "Atif yogunlugu mu, guncellik mi? Ne kadar?"
 * sorularinin cevaplari burada karsilikli (reciprocal) matrise cevrilir.
 *
 * EKSIK KARSILASTIRMA (Harker, 1987): 7 kriterin tam matrisi 21 soru ister;
 * akademisyeni kaybettirir. Kullanici yalnizca bir kismini yanitlar; agirliklar
 * Harker'in eksik matris uyarlamasiyla hesaplanir: eksik a_ij yerine 0 yazilir,
 * kosegene "o satirdaki eksik sayisi + 1" konur, bu matrisin asal ozvektoru
 * agirliklardir. Tam matriste standart ozvektorle AYNI sonucu verir; yani
 * pyDecision ile capraz dogrulanan yontemin dogrudan genellemesi.
 *
 * NEDEN pyMissingAHP (genetik algoritma) DEGIL: GA rastgele; ayni cevaplar
 * farkli calistirmalarda farkli agirlik verebilir. Bir siralama urununde ve
 * juri onunde kabul edilemez. Harker kapali form ve deterministik.
 *
 * KOSULLAR:
 *  - Yanitlanan karsilastirmalar kriterleri BAGLAMALI (graf bagli); aksi halde
 *    iki grubun birbirine gore agirligi tanimsizdir.
 *  - Yanit sayisi = kriter sayisi - 1 (agac) ise tamamlanmis matris tanim geregi
 *    tutarlidir ve CR bir sey olcmez. CR ancak fazladan yanit (dongu) varsa
 *    anlamlidir; yanitta `consistencyApplies` bunu soyler.
 *
 * Kaynaklar:
 *  Saaty, T.L. (1980). The Analytic Hierarchy Process. McGraw-Hill.
 *  Harker, P.T. (1987). Incomplete pairwise comparisons in the analytic
 *    hierarchy process. Mathematical Modelling 9(11), 837-848.
 */
import { CRITERIA, deriveWeights, consistencyRatio } from './ahpMatrix.js';
import { DEFAULT_WEIGHTS } from './ahp.js';
import { msg, DEFAULT_LANG } from './serverI18n.js';

export const CR_THRESHOLD = 0.1;

/** Kriterin kullaniciya gosterilen adi (serverI18n). */
export const criterionLabel = (c, lang = DEFAULT_LANG) => msg(lang, `criteria.${c}`) || c;

/** Kaydirici duzeyi (1-5) -> Saaty yogunlugu. */
const RATING_TO_INTENSITY = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 };

/**
 * Kaydiricilar: her kritere 1-5 onem duzeyi. Tanim geregi tutarli oldugu icin
 * CR hesaplanmaz; donus degerinde bunu acikca soyleriz.
 */
export function ratingsToWeights(ratings, lang = DEFAULT_LANG) {
  const raw = {};
  let sum = 0;
  for (const c of CRITERIA) {
    const level = Math.round(Number(ratings?.[c]));
    const intensity = RATING_TO_INTENSITY[level];
    raw[c] = intensity ?? RATING_TO_INTENSITY[3];
    sum += raw[c];
  }
  const weights = Object.fromEntries(CRITERIA.map((c) => [c, raw[c] / sum]));
  return {
    weights,
    consistencyApplies: false,
    note: msg(lang, 'ratingsNote'),
  };
}

/** Saaty olceginin tum gecerli degerleri: 1/9 .. 9. */
export const SAATY_VALUES = [
  ...[9, 8, 7, 6, 5, 4, 3, 2].map((v) => 1 / v), 1, 2, 3, 4, 5, 6, 7, 8, 9,
];

/** Saaty olcegine (1/9..9) kirp ve en yakin gecerli degere yuvarla. */
export function snapToSaaty(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value >= 1) return Math.min(9, Math.max(1, Math.round(value)));
  return 1 / Math.min(9, Math.max(1, Math.round(1 / value)));
}

/** Degeri izin verilen kumenin log-olcekte en yakin elemanina yuvarlar. */
function snapToAllowed(value, allowed) {
  return allowed.reduce((best, v) =>
    Math.abs(Math.log(v) - Math.log(value)) < Math.abs(Math.log(best) - Math.log(value)) ? v : best
  );
}

function degreeKey(v) {
  if (v <= 1.01) return 'equal';
  if (v <= 3) return 'slight';
  if (v <= 5) return 'clear';
  if (v <= 7) return 'strong';
  return 'extreme';
}

/** Tek bir yargiyi duz dile cevirir: "X, Y'den biraz daha önemli" / "X is slightly more important than Y". */
export function describeJudgment(a, b, value, lang = DEFAULT_LANG) {
  const A = criterionLabel(a, lang);
  const B = criterionLabel(b, lang);
  if (Math.abs(value - 1) < 1e-9) return msg(lang, 'judgment.equal', { a: A, b: B });
  if (value > 1) return msg(lang, 'judgment.more', { a: A, b: B, degree: msg(lang, `degree.${degreeKey(value)}`) });
  return msg(lang, 'judgment.more', { a: B, b: A, degree: msg(lang, `degree.${degreeKey(1 / value)}`) });
}

function capitalize(s, lang = DEFAULT_LANG) {
  return s ? s[0].toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US') + s.slice(1) : s;
}

function sanitizeAllowed(values) {
  if (!Array.isArray(values)) return SAATY_VALUES;
  const clean = values.map(Number).filter((v) => Number.isFinite(v) && v >= 1 / 9 - 1e-9 && v <= 9 + 1e-9);
  return clean.length >= 2 ? clean : SAATY_VALUES;
}

// --- Harker: eksik matristen agirlik -----------------------------------------

/**
 * @param {number} n
 * @param {Array<{i:number, j:number, value:number}>} edges  yonlu: a_ij = value
 * @returns {{weights: number[], completed: number[][]}}
 */
export function harkerWeights(n, edges) {
  const known = Array.from({ length: n }, () => Array(n).fill(null));
  for (const { i, j, value } of edges) {
    known[i][j] = value;
    known[j][i] = 1 / value;
  }
  const C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (i === j) return 1 + known[i].filter((v, k) => k !== i && v === null).length;
    return known[i][j] ?? 0;
  }));
  const weights = deriveWeights(C, { iterations: 2000 });
  const completed = known.map((row, i) => row.map((v, j) => (i === j ? 1 : v ?? weights[i] / weights[j])));
  return { weights, completed };
}

/** Yanitlanan karsilastirmalarin grafinin bagli bilesenleri. */
export function components(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const { i, j } of edges) parent[find(i)] = find(j);
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  return [...groups.values()];
}

function crOf(n, edges) {
  const { weights, completed } = harkerWeights(n, edges);
  const { consistencyRatio: cr } = consistencyRatio(completed, weights);
  return { weights, cr };
}

/**
 * Diger yanitlarla en cok celisen TEK yanit ve onun en kucuk duzeltmesi.
 *
 * Her yanit x izin verilen her deger denenir; CR'yi esigin altina indiren
 * degisikliklerin EN KUCUGU secilir (log uzakligi), hicbiri inmiyorsa CR'yi en
 * cok dusuren. Olculen: "celisen uclunun ucuncu kenarini duzelt" kurali, olcek
 * 7'de bittigi icin 94 tutarsiz durumun 30'unda ise yaramiyordu.
 */
function bestSingleFix(n, edges, allowed) {
  let bestFixing = null;
  let bestOverall = null;
  edges.forEach((edge, idx) => {
    for (const v of allowed) {
      if (Math.abs(Math.log(v) - Math.log(edge.value)) < 1e-9) continue;
      const trial = edges.map((e, k) => (k === idx ? { ...e, value: v } : e));
      const { cr } = crOf(n, trial);
      const change = Math.abs(Math.log(v) - Math.log(edge.value));
      const cand = { idx, value: v, cr, change };
      if (cr < CR_THRESHOLD &&
          (!bestFixing || change < bestFixing.change - 1e-9 ||
           (Math.abs(change - bestFixing.change) <= 1e-9 && cr < bestFixing.cr))) bestFixing = cand;
      if (!bestOverall || cr < bestOverall.cr - 1e-9 ||
          (Math.abs(cr - bestOverall.cr) <= 1e-9 && change < bestOverall.change)) bestOverall = cand;
    }
  });
  return bestFixing || bestOverall;
}

/**
 * Yanitlanan ikili karsilastirmalardan agirlik uretir. Eksik yanit serbest.
 *
 * Karsilastirmalarda gecen kriterler AHP ile agirliklandirilir ve varsayilan
 * agirliklarinin TOPLAMI kadar pay alir; hic gecmeyen kriterler varsayilan
 * paylarini korur. 7 kriterin hepsi gectiyse sonuc saf AHP agirligidir.
 *
 * @param {Array<{a: string, b: string, value: number}>} judgments
 *   value > 1: a, b'den `value` kat onemli; value < 1: b daha onemli; 1: esit.
 * @param {{allowedValues?: number[]}} [options]
 */
export function evaluateComparisons(judgments, { allowedValues, lang = DEFAULT_LANG } = {}) {
  const allowed = sanitizeAllowed(allowedValues);

  // Gecerli, tekrarsiz yanitlar (ayni cift iki kez gelirse sonuncusu gecerli).
  const byPair = new Map();
  for (const j of judgments || []) {
    if (!CRITERIA.includes(j?.a) || !CRITERIA.includes(j?.b) || j.a === j.b) continue;
    const v = Number(j.value);
    if (!Number.isFinite(v) || v <= 0) continue;
    const key = [j.a, j.b].sort().join('|');
    byPair.set(key, { a: j.a, b: j.b, value: snapToSaaty(v) });
  }
  const answered = [...byPair.values()];
  const involved = CRITERIA.filter((c) => answered.some((j) => j.a === c || j.b === c));

  if (involved.length < 2) return { ok: false, error: msg(lang, 'pairwise.needOne') };

  const index = Object.fromEntries(involved.map((c, i) => [c, i]));
  const n = involved.length;
  const edges = answered.map((j) => ({ i: index[j.a], j: index[j.b], value: j.value, a: j.a, b: j.b }));

  const comps = components(n, edges);
  if (comps.length > 1) {
    return {
      ok: false,
      error: msg(lang, 'pairwise.disconnected'),
      groups: comps.map((g) => g.map((i) => involved[i])),
    };
  }

  const { weights: vector, cr } = crOf(n, edges);
  // Dongu yoksa (agac) tamamlama tanim geregi tutarli: CR bir sey olcmez.
  const consistencyApplies = n >= 3 && edges.length > n - 1;
  const isConsistent = !consistencyApplies || cr < CR_THRESHOLD;

  const share = involved.reduce((acc, c) => acc + DEFAULT_WEIGHTS[c], 0);
  const weights = { ...DEFAULT_WEIGHTS };
  involved.forEach((c, i) => { weights[c] = vector[i] * share; });

  let inconsistency = null;
  if (!isConsistent) {
    const fix = bestSingleFix(n, edges, allowed);
    const edge = edges[fix.idx];
    // Bu yanit OLMADAN diger yanitlarin ima ettigi deger (graf hala bagliysa).
    const others = edges.filter((_, k) => k !== fix.idx);
    let implied = null;
    if (components(n, others).length === 1) {
      const w = harkerWeights(n, others).weights;
      implied = snapToAllowed(w[edge.i] / w[edge.j], allowed);
    }
    inconsistency = {
      criteria: [edge.a, edge.b],
      explanation: implied
        ? msg(lang, 'pairwise.conflict', {
          judgment: capitalize(describeJudgment(edge.a, edge.b, edge.value, lang), lang),
          implied: describeJudgment(edge.a, edge.b, implied, lang),
        })
        : msg(lang, 'pairwise.conflictNoImplied', { judgment: capitalize(describeJudgment(edge.a, edge.b, edge.value, lang), lang) }),
      suggestion: {
        a: edge.a,
        b: edge.b,
        value: fix.value,
        resultingCR: fix.cr,
        fixesIt: fix.cr < CR_THRESHOLD,
        text: msg(lang, fix.cr < CR_THRESHOLD ? 'pairwise.fix' : 'pairwise.fixPartial', {
          judgment: describeJudgment(edge.a, edge.b, fix.value, lang),
        }),
      },
    };
  }

  return {
    ok: true,
    weights,
    answered: answered.length,
    criteriaCovered: involved,
    consistencyRatio: consistencyApplies ? cr : 0,
    consistencyApplies,
    isConsistent,
    inconsistency,
  };
}
