/**
 * Hata yayılımı — birinci mertebe (GUM, JCGM 100:2008 §5.1).
 *
 * Model bir JavaScript fonksiyonu olarak verilir: `(values) => number`.
 * Kullanıcının yazdığı formül dizesi burada **değerlendirilmez** (`eval` yok);
 * dizeyi fonksiyona çevirmek WO-007'nin güvenlik işi.
 *
 * Kısmi türevler sayısal alınır. Sembolik türev bir ifade ayrıştırıcısı
 * ister, o da kullanıcı girdisini çalıştırma kapısı açar.
 */

import { ORIGIN } from './descriptives.js';

/**
 * Merkezi fark adımı. h = ε^(1/3)·max(|x|, 1):
 * - ε^(1/3) merkezi farkta yuvarlama (ε/h) ile kesme (h²) hatasını dengeler.
 * - max(|x|, 1) ölçeklendirme: x = 1e6 iken sabit küçük adım yuvarlamada
 *   kaybolur, x = 0 iken ölçekli adım sıfıra iner.
 */
export const stepFor = (x) => Number.EPSILON ** (1 / 3) * Math.max(Math.abs(x), 1);

/**
 * İki tolerans: türev güvenilir sayılmak için adım yarıya indirildiğinde
 * tahminin bu kadardan fazla değişmemesi gerekir. Düzgün bir fonksiyonda
 * ölçülen değişim 1e-9 düzeyinde; 1e-3 bol emniyet payıdır.
 */
const DERIVATIVE_AGREEMENT = 1e-3;

/** Tek adımlı merkezi fark. */
function centralDifference(model, at, index, h) {
  const x = at[index];
  const plus = [...at];
  const minus = [...at];
  plus[index] = x + h;
  minus[index] = x - h;
  const f1 = model(plus);
  const f2 = model(minus);
  if (!Number.isFinite(f1) || !Number.isFinite(f2)) return null;
  // Gerçek adım: kayan nokta (x+h)-(x-h) tam 2h olmayabilir.
  const actual = plus[index] - minus[index];
  return actual === 0 ? null : (f1 - f2) / actual;
}

/**
 * Tek değişkene göre sayısal kısmi türev (merkezi fark + tutarlılık kontrolü).
 *
 * Tahmin iki adımla alınır (h ve h/2) ve ikisi uyuşmazsa `null` döner.
 * Gerekçe: `1/x`'in x = 0'daki türevi tanımsız, ama merkezi fark iki yanda da
 * sonlu değer bulduğu için sessizce 1/h² gibi bir sayı üretir. Ölçülen: 2,7e10.
 * Böyle bir duyarlılık katsayısı belirsizlik bütçesini sessizce bozar; sayı
 * uydurmak yerine hesaplanamadığı söylenir (tüzük 2.8). Adım yarıya inince
 * düzgün fonksiyonun tahmini O(h²) değişir, kutup yakınında ~4 kat.
 *
 * @param {(values: number[]) => number} model
 * @param {number[]} at değerlendirme noktası
 * @param {number} index türevi alınacak değişken
 * @returns {number|null} model tanımsızsa ya da tahmin kararsızsa null
 */
export function partialDerivative(model, at, index) {
  const h = stepFor(at[index]);
  const coarse = centralDifference(model, at, index, h);
  if (coarse === null) return null;
  const fine = centralDifference(model, at, index, h / 2);
  if (fine === null) return null;
  const scale = Math.max(Math.abs(coarse), Math.abs(fine));
  if (scale === 0) return 0;
  return Math.abs(coarse - fine) / scale > DERIVATIVE_AGREEMENT ? null : coarse;
}

/**
 * Birinci mertebe belirsizlik yayılımı.
 *
 * @param {(values: number[]) => number} model dolaylı büyüklüğün modeli
 * @param {Array<{name?: string, value: number, uncertainty: number|null, unit?: string, df?: number}>} inputs
 * @returns {object} value, combinedUncertainty, components (duyarlılık
 *   katsayısı ve katkı yüzdesi ile), effectiveDf, warnings, error
 *
 * Belirsizliği `null` olan girdi **sıfır sayılmaz**: bütçede "girilmemiş"
 * olarak görünür ve bileşik belirsizlik `null` döner. Eksik veriyi sıfır
 * saymak, belirsizliği olduğundan küçük gösterir (WO-009 dürüstlük kuralı).
 */
export function propagate(model, inputs) {
  const list = Array.isArray(inputs) ? inputs : [];
  const base = {
    test: 'propagation', origin: ORIGIN, value: null,
    combinedUncertainty: null, components: [], effectiveDf: null,
    warnings: [], error: null,
  };
  if (typeof model !== 'function' || list.length === 0) return { ...base, error: 'no_data' };
  if (list.some((i) => !Number.isFinite(i?.value))) return { ...base, error: 'invalid_input' };

  const at = list.map((i) => i.value);
  const value = model(at);
  if (!Number.isFinite(value)) return { ...base, error: 'model_undefined' };

  const warnings = [];
  const components = list.map((input, index) => {
    const sensitivity = partialDerivative(model, at, index);
    const u = Number.isFinite(input.uncertainty) ? input.uncertainty : null;
    return {
      name: input.name ?? `x${index + 1}`,
      value: input.value,
      unit: input.unit ?? null,
      uncertainty: u,
      // Duyarlılık katsayısı c_i = ∂f/∂x_i
      sensitivity,
      // Katkı u_i = |c_i|·u(x_i); bütçe tablosunun ana sütunu
      contribution: u === null || sensitivity === null ? null : Math.abs(sensitivity) * u,
      df: Number.isFinite(input.df) ? input.df : null,
      share: null,
    };
  });

  const missing = components.filter((c) => c.uncertainty === null);
  if (missing.length) warnings.push('uncertainty_missing');
  if (components.some((c) => c.sensitivity === null)) warnings.push('sensitivity_undefined');

  // Bir bileşenin belirsizliği girilmemişse bileşik belirsizlik hesaplanamaz.
  if (warnings.includes('uncertainty_missing') || warnings.includes('sensitivity_undefined')) {
    return { ...base, value, components, warnings, error: 'uncertainty_missing' };
  }

  const squares = components.map((c) => c.contribution ** 2);
  const combined = Math.sqrt(squares.reduce((a, b) => a + b, 0));
  // Katkı payları: bütçe tablosunda hangi bileşen belirsizliği sürüklüyor.
  const totalSquare = squares.reduce((a, b) => a + b, 0);
  components.forEach((c, i) => {
    c.share = totalSquare > 0 ? squares[i] / totalSquare : null;
  });

  return {
    ...base, value, combinedUncertainty: combined, components,
    effectiveDf: effectiveDegreesOfFreedom(combined, components),
    warnings,
  };
}

/**
 * Welch-Satterthwaite etkin serbestlik derecesi (GUM G.4.1).
 * Bileşenlerin herhangi birinde serbestlik derecesi yoksa null: eksik veriyle
 * sonsuz varsaymak genişletilmiş belirsizliği olduğundan küçük gösterir.
 */
export function effectiveDegreesOfFreedom(combined, components) {
  if (!(combined > 0) || !components.length) return null;
  if (components.some((c) => c.df === null || !(c.df > 0) || c.contribution === null)) return null;
  let denominator = 0;
  for (const c of components) denominator += c.contribution ** 4 / c.df;
  return denominator > 0 ? combined ** 4 / denominator : null;
}
