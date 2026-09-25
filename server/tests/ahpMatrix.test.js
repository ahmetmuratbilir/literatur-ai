import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CRITERIA,
  PAIRWISE_MATRIX,
  deriveWeights,
  consistencyRatio,
  validateMatrix,
  getAhpWeights,
} from '../services/ahpMatrix.js';
import { DEFAULT_WEIGHTS, getWeightingMethodology } from '../services/ahp.js';

test('ikili karsilastirma matrisi karsilikli ve dogru boyutta', () => {
  assert.equal(PAIRWISE_MATRIX.length, CRITERIA.length);
  assert.deepEqual(validateMatrix(PAIRWISE_MATRIX), [], 'matris a_ji = 1/a_ij kuralini saglamali');
});

test('karsilikli olmayan matris reddedilir', () => {
  const broken = [
    [1, 3],
    [1, 1], // olmasi gereken: 1/3
  ];

  assert.ok(validateMatrix(broken).length > 0);
});

test('turetilen agirliklar normalize edilmis bir vektor', () => {
  const weights = deriveWeights(PAIRWISE_MATRIX);
  const sum = weights.reduce((a, b) => a + b, 0);

  assert.ok(Math.abs(sum - 1) < 1e-9, `toplam 1 olmali, ${sum} bulundu`);
  assert.ok(weights.every((w) => w > 0));
});

test('bilinen bir matris icin ozvektor dogru hesaplanir', () => {
  // Tam tutarli matris: a_ij = w_i / w_j, w = [0.5, 0.3, 0.2]
  const known = [0.5, 0.3, 0.2];
  const matrix = known.map((wi) => known.map((wj) => wi / wj));

  const derived = deriveWeights(matrix);

  derived.forEach((value, i) => {
    assert.ok(Math.abs(value - known[i]) < 1e-9, `${i}. agirlik ${known[i]} olmali, ${value} bulundu`);
  });

  // Tam tutarli matriste lambdaMax = n ve CR = 0.
  const { lambdaMax, consistencyRatio: cr } = consistencyRatio(matrix, derived);
  assert.ok(Math.abs(lambdaMax - 3) < 1e-9);
  assert.ok(Math.abs(cr) < 1e-9);
});

test('tutarlilik orani Saaty esigini gecmiyor', () => {
  const { consistencyRatio: cr, isConsistent, lambdaMax } = getAhpWeights();

  assert.ok(cr < 0.1, `CR 0.10'un altinda olmali, ${cr} bulundu`);
  assert.equal(isConsistent, true);
  // lambdaMax her zaman >= n olmali.
  assert.ok(lambdaMax >= CRITERIA.length - 1e-9);
});

test('tutarsiz yargilar yuksek CR uretir', () => {
  // A > B, B > C, ama C > A: dongusel ve celiskili.
  const inconsistent = [
    [1, 9, 1 / 9],
    [1 / 9, 1, 9],
    [9, 1 / 9, 1],
  ];

  const weights = deriveWeights(inconsistent);
  const { consistencyRatio: cr } = consistencyRatio(inconsistent, weights);

  assert.ok(cr > 0.1, `celiskili matris yuksek CR uretmeli, ${cr} bulundu`);
});

test('DEFAULT_WEIGHTS matristen turetiliyor, elle yazilmiyor', () => {
  const derived = getAhpWeights().weights;

  assert.deepEqual(DEFAULT_WEIGHTS, derived);

  const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);

  for (const criterion of CRITERIA) {
    assert.equal(typeof DEFAULT_WEIGHTS[criterion], 'number');
  }
});

test('turetilen agirliklar onceki sabitlere yakin kaliyor', () => {
  // Amac yontemi duzeltmek, siralamayi altust etmek degil.
  const previousHardcoded = {
    keyword: 0.20, similarity: 0.12, citation: 0.23, quality: 0.18,
    recency: 0.12, reliability: 0.10, oa: 0.05,
  };

  for (const [criterion, previous] of Object.entries(previousHardcoded)) {
    const delta = Math.abs(DEFAULT_WEIGHTS[criterion] - previous);
    assert.ok(delta < 0.05, `${criterion} agirligi 0.05'ten fazla kaymamali (${delta.toFixed(4)})`);
  }
});

test('yontem kunyesi raporlanabilir metrikleri icerir', () => {
  const methodology = getWeightingMethodology();

  assert.match(methodology.method, /AHP/);
  assert.equal(methodology.criteria.length, CRITERIA.length);
  assert.equal(methodology.pairwiseMatrix.length, CRITERIA.length);
  assert.equal(typeof methodology.consistencyRatio, 'number');
  assert.equal(methodology.consistencyThreshold, 0.1);
  assert.equal(methodology.isConsistent, true);
});
