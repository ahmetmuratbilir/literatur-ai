/**
 * Dağılım fonksiyonları — saf matematik, dış bağımlılık yok.
 *
 * WO-006: hesap kendi kodumuzda yazılır, yayımlanmış bir kütüphanenin
 * sayılarıyla çapraz doğrulanır (client/tests/fixtures/stats-reference.json).
 * Buradaki hiçbir fonksiyon ağ, depolama veya DOM kullanmaz.
 *
 * Yöntemler standart ve kaynakları belirtilmiş: Lanczos yaklaşımı (log gama),
 * Lentz'in sürekli kesri (düzenlenmiş eksik beta ve gama), Acklam'ın ters
 * normal yaklaşımı + Newton düzeltmesi. Hepsi kamuya açık sayısal yöntemler;
 * kod alıntısı değil, yöntemin uygulanmasıdır.
 */

// --- log Γ(x) — Lanczos, g=7, n=9 (yaklaşık 15 basamak) -----------------
const LANCZOS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** log Γ(x), x > 0. */
export function logGamma(x) {
  if (!(x > 0)) return NaN;
  // Yansıma formülü küçük x için: Γ(x)Γ(1-x) = π / sin(πx)
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let series = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) series += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

const EPS = 3e-16;
const TINY = 1e-300;
const MAX_ITER = 300;

// --- Düzenlenmiş eksik beta I_x(a,b) ------------------------------------

/** Lentz'in değiştirilmiş sürekli kesri (beta). */
function betaContinuedFraction(a, b, x) {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    // Çift adım
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    // Tek adım
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Düzenlenmiş eksik beta I_x(a, b); a,b > 0 ve 0 ≤ x ≤ 1. */
export function incompleteBeta(a, b, x) {
  if (!(a > 0) || !(b > 0) || Number.isNaN(x)) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  // Sürekli kesir yalnız x < (a+1)/(a+b+2) bölgesinde hızlı yakınsıyor;
  // diğer yarıda simetriden gidilir: I_x(a,b) = 1 - I_{1-x}(b,a).
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

// --- Düzenlenmiş eksik gama P(a,x) --------------------------------------

function gammaSeries(a, x) {
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n <= MAX_ITER; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaContinuedFraction(a, x) {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Düzenlenmiş eksik gama P(a, x) = γ(a,x)/Γ(a). */
export function incompleteGamma(a, x) {
  if (!(a > 0) || x < 0 || Number.isNaN(x)) return NaN;
  if (x === 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/**
 * Üst kuyruk Q(a, x) = 1 - P(a, x), **doğrudan**. Çıkarma yoluyla
 * hesaplamak küçük sonuçlarda anlamlı basamakları yiyor: Φ(-8) için SciPy'ye
 * göre bağıl hata 1,8e-2 ölçüldü. Kuyruk doğrudan hesaplanınca 1e-15'e indi.
 */
export function incompleteGammaUpper(a, x) {
  if (!(a > 0) || x < 0 || Number.isNaN(x)) return NaN;
  if (x === 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

// --- Dağılım fonksiyonları ----------------------------------------------

/** erf(x). */
export function erf(x) {
  if (x === 0) return 0;
  const p = incompleteGamma(0.5, x * x);
  return x > 0 ? p : -p;
}

/** erfc(x) = 1 - erf(x); küçük sonuçlarda doğrudan hesaplanır. */
export function erfc(x) {
  if (Number.isNaN(x)) return NaN;
  return x >= 0 ? incompleteGammaUpper(0.5, x * x) : 1 + incompleteGamma(0.5, x * x);
}

/** Standart normal birikimli dağılım Φ(z). */
export function normalCdf(z) {
  if (Number.isNaN(z)) return NaN;
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  // Negatif kuyruk erfc ile doğrudan: Φ(z) = ½·erfc(-z/√2).
  return z >= 0 ? 1 - 0.5 * erfc(z / Math.SQRT2) : 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Student t dağılımının iki yönlü p değeri: P(|T| ≥ |t|), sd serbestlik
 * derecesi. Tek yönlü gereken yerde çağıran taraf ikiye böler.
 */
export function tTwoTailedP(t, df) {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / 2, 0.5, df / (df + t * t));
}

/** Student t birikimli dağılımı P(T ≤ t). */
export function tCdf(t, df) {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  const half = tTwoTailedP(t, df) / 2;
  return t > 0 ? 1 - half : half;
}

/** F dağılımının sağ kuyruğu P(F ≥ f); Levene ve ANOVA bunu kullanır. */
export function fUpperTailP(f, df1, df2) {
  if (!(df1 > 0) || !(df2 > 0) || Number.isNaN(f) || f < 0) return NaN;
  if (!Number.isFinite(f)) return 0;
  // Simetriden doğrudan üst kuyruk: 1 - I_x(a,b) = I_{1-x}(b,a). Çıkarmayla
  // hesaplamak küçük p değerlerinde basamak kaybediyordu.
  return incompleteBeta(df2 / 2, df1 / 2, df2 / (df1 * f + df2));
}

// --- Ters normal (güven aralıkları için) --------------------------------

// Acklam'ın rasyonel yaklaşımı: bağıl hata ~1.15e-9. Altta tek Newton adımı
// var; ikisi birlikte makine hassasiyetine iniyor.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** Standart normal ters birikimli dağılım Φ⁻¹(p), 0 < p < 1. */
export function normalQuantile(p) {
  if (!(p > 0) || !(p < 1)) return NaN;
  // Üst yarı simetriyle çözülür: p ∈ [0.5, 1] için 1-p kayan noktada tam
  // hesaplanır (Sterbenz), böylece Newton adımı Φ(z)≈1 civarındaki çıkarma
  // kaybına girmez. Düzeltmeden önce p=1-1e-9'da bağıl hata 4,8e-11'di.
  if (p > 0.5) return -normalQuantile(1 - p);
  const low = 0.02425;
  let z;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
      / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p <= 1 - low) {
    const q = p - 0.5;
    const r = q * q;
    z = ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q)
      / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
      / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  // Newton düzeltmesi: Φ(z) - p = 0, türev standart normal yoğunluk. İki adım,
  // çünkü uç kuyruklarda tek adım 1e-9 bağıl hata bırakıyordu.
  for (let i = 0; i < 2; i++) {
    const density = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
    if (!(density > 0)) break;
    z -= (normalCdf(z) - p) / density;
  }
  return z;
}
