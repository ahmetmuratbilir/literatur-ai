import test from 'node:test';
import assert from 'node:assert/strict';

import { PAIRWISE_MATRIX, deriveWeights, consistencyRatio } from '../services/ahpMatrix.js';

/**
 * CAPRAZ DOGRULAMA: bizim AHP hesabimiz yayimlanmis bir kutuphaneyle ayni mi?
 *
 * Referans degerler pyDecision 5.1.1 (Valdecy Pereira, GPL-3.0) ile
 * 30 Eyl 2026'da uretildi:
 *     from pyDecision.algorithm import ahp_method
 *     weights, cr = ahp_method(M, wd='me')   # 'me' = max_eigen (asal ozvektor)
 *
 * Kutuphanenin KODU projeye alinmadi; yalnizca urettigi SAYILAR test verisi
 * olarak burada. Python kurmadan her `npm test`te calisir.
 *
 * Neden 'me': Saaty'nin asil yontemi asal ozvektordur ve bizim deriveWeights
 * de onu hesapliyor. pyDecision'in VARSAYILANI ('m', sutun-normalize ortalama)
 * yaklasik bir yontemdir; dongusel matriste ozvektorden 0,023 sapiyor.
 */
const PYDECISION_ME = {
  bizim_7x7: {
    matrix: PAIRWISE_MATRIX,
    weights: [0.2093254825, 0.1046627413, 0.2165752817, 0.2093254825, 0.1046627413, 0.1046627413, 0.0507855294],
    cr: 0.0006432604,
  },
  dongusel_3x3: {
    matrix: [[1, 5, 1 / 3], [1 / 5, 1, 3], [3, 1 / 3, 1]],
    weights: [0.3914183367, 0.2784466522, 0.330135011],
    cr: 1.5845151088,
  },
  ornek_4x4: {
    matrix: [[1, 1 / 3, 1 / 5, 1], [3, 1, 1 / 2, 2], [5, 2, 1, 4], [1, 1 / 2, 1 / 4, 1]],
    weights: [0.1033200344, 0.2672215363, 0.5087127983, 0.120745631],
    cr: 0.0057424338,
  },
};

for (const [name, ref] of Object.entries(PYDECISION_ME)) {
  test(`pyDecision ile ayni sonuc: ${name}`, () => {
    const w = deriveWeights(ref.matrix);
    const { consistencyRatio: cr } = consistencyRatio(ref.matrix, w);
    ref.weights.forEach((expected, i) => {
      assert.ok(Math.abs(w[i] - expected) < 1e-8, `agirlik[${i}] ${w[i]} != ${expected}`);
    });
    assert.ok(Math.abs(cr - ref.cr) < 1e-8, `CR ${cr} != ${ref.cr}`);
  });
}
