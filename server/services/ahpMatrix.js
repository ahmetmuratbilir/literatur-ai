/**
 * AHP (Analytic Hierarchy Process) ağırlık türetme katmanı.
 *
 * Önceki model ağırlıkları elle yazılmış sabitlerden okuyordu. Bu bir AHP
 * değil, ağırlıklı toplam (WSM/SAW) modelidir: AHP'nin tanımlayıcı üç adımı —
 * ikili karşılaştırma matrisi, asal özvektör ve tutarlılık oranı — yoktu.
 * Akademik bir çıktıda "AHP ile sıralandı" ifadesinin savunulabilir olması
 * için üçünün de bulunması gerekir.
 *
 * Kaynak: Saaty, T.L. (1980). The Analytic Hierarchy Process.
 */

export const CRITERIA = [
  'keyword',
  'similarity',
  'citation',
  'quality',
  'recency',
  'reliability',
  'oa',
];

/**
 * Saaty 1-9 ölçeğinde ikili karşılaştırma matrisi.
 *
 * matrix[i][j] = i kriterinin j kriterine göre kaç kat daha önemli olduğu.
 * 1 = eşit önem, 2 = biraz daha önemli, 3 = orta derecede daha önemli,
 * 4-5 = belirgin şekilde daha önemli. Matris karşılıklıdır: a_ji = 1 / a_ij.
 *
 * Yargıların gerekçeleri:
 * - citation ve keyword en ağır iki kriter: bir makalenin hem konuyla
 *   eşleşmesi hem de alan tarafından kullanılıyor olması esas ölçüt.
 * - quality (hakemlilik/yayın tipi) onları yakından izler.
 * - similarity ve recency orta düzeyde; recency tek başına kalite göstergesi
 *   değildir, bu yüzden citation'ın yarısı ağırlıkta.
 * - reliability doğrulayıcı bir kriter, birincil değil.
 * - oa erişim kolaylığıdır, bilimsel değer ölçütü değil: en düşük ağırlık.
 */
export const PAIRWISE_MATRIX = [
  //            keyword  simil.  citat.  qual.  recen.  reliab.  oa
  /* keyword */ [1, 2, 1, 1, 2, 2, 4],
  /* simil.  */ [1 / 2, 1, 1 / 2, 1 / 2, 1, 1, 2],
  /* citat.  */ [1, 2, 1, 1, 2, 2, 5],
  /* qual.   */ [1, 2, 1, 1, 2, 2, 4],
  /* recen.  */ [1 / 2, 1, 1 / 2, 1 / 2, 1, 1, 2],
  /* reliab. */ [1 / 2, 1, 1 / 2, 1 / 2, 1, 1, 2],
  /* oa      */ [1 / 4, 1 / 2, 1 / 5, 1 / 4, 1 / 2, 1 / 2, 1],
];

/**
 * Saaty'nin rastgele tutarlılık indeksi (Random Index), matris boyutuna göre.
 * Index = matris boyutu.
 */
const RANDOM_INDEX = [0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

/**
 * Asal özvektörü kuvvet yöntemiyle (power iteration) hesaplar ve normalize eder.
 */
export function deriveWeights(matrix, { iterations = 200, tolerance = 1e-12 } = {}) {
  const n = matrix.length;
  let vector = new Array(n).fill(1 / n);

  for (let step = 0; step < iterations; step++) {
    const next = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        next[i] += matrix[i][j] * vector[j];
      }
    }

    const sum = next.reduce((acc, value) => acc + value, 0);
    if (sum === 0) break;

    for (let i = 0; i < n; i++) next[i] /= sum;

    const delta = next.reduce((acc, value, i) => acc + Math.abs(value - vector[i]), 0);
    vector = next;
    if (delta < tolerance) break;
  }

  return vector;
}

/**
 * λmax, tutarlılık indeksi (CI) ve tutarlılık oranı (CR).
 *
 * CR < 0.10 kabul edilebilir sayılır (Saaty, 1980). Üzerindeyse ikili
 * yargılar kendi içinde çelişkilidir ve gözden geçirilmelidir.
 */
export function consistencyRatio(matrix, weights) {
  const n = matrix.length;

  // λmax = ortalama( (A·w)_i / w_i )
  let lambdaSum = 0;
  for (let i = 0; i < n; i++) {
    let weightedSum = 0;
    for (let j = 0; j < n; j++) {
      weightedSum += matrix[i][j] * weights[j];
    }
    lambdaSum += weightedSum / weights[i];
  }

  const lambdaMax = lambdaSum / n;
  const consistencyIndex = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const randomIndex = RANDOM_INDEX[n] ?? RANDOM_INDEX[RANDOM_INDEX.length - 1];
  const ratio = randomIndex > 0 ? consistencyIndex / randomIndex : 0;

  return { lambdaMax, consistencyIndex, randomIndex, consistencyRatio: ratio };
}

/**
 * Matrisin karşılıklı (reciprocal) olup olmadığını doğrular.
 * Elle düzenlenen bir matriste en sık yapılan hata budur.
 */
export function validateMatrix(matrix) {
  const problems = [];
  const n = matrix.length;

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
      problems.push(`${i}. satır ${n} elemanlı olmalı`);
      continue;
    }
    if (Math.abs(matrix[i][i] - 1) > 1e-9) {
      problems.push(`köşegen [${i}][${i}] 1 olmalı`);
    }
    for (let j = 0; j < n; j++) {
      const expected = 1 / matrix[j][i];
      if (Math.abs(matrix[i][j] - expected) > 1e-9) {
        problems.push(`[${i}][${j}] ile [${j}][${i}] karşılıklı değil`);
      }
    }
  }

  return problems;
}

let cached = null;

/**
 * Türetilmiş ağırlıklar ve tutarlılık metrikleri. Matris sabit olduğu için
 * sonuç bir kez hesaplanıp saklanır.
 */
export function getAhpWeights() {
  if (cached) return cached;

  const problems = validateMatrix(PAIRWISE_MATRIX);
  if (problems.length > 0) {
    throw new Error(`AHP matrisi geçersiz: ${problems.join('; ')}`);
  }

  const vector = deriveWeights(PAIRWISE_MATRIX);
  const consistency = consistencyRatio(PAIRWISE_MATRIX, vector);

  const weights = {};
  CRITERIA.forEach((criterion, index) => {
    weights[criterion] = vector[index];
  });

  cached = {
    weights,
    ...consistency,
    isConsistent: consistency.consistencyRatio < 0.1,
  };

  return cached;
}
