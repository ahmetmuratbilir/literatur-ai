import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ratingsToWeights, snapToSaaty, describeJudgment, harkerWeights, components, evaluateComparisons,
} from '../services/ahpPairwise.js';
import { DEFAULT_WEIGHTS } from '../services/ahp.js';
import { CRITERIA } from '../services/ahpMatrix.js';

const sum = (w) => Object.values(w).reduce((a, b) => a + b, 0);
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const UI = [7, 3, 1, 1 / 3, 1 / 7];

test('kaydiricilar: toplam 1, CR uygulanmaz ve bu acikca soylenir', () => {
  const r = ratingsToWeights({ citation: 5, recency: 1 });
  assert.ok(close(sum(r.weights), 1));
  assert.equal(r.consistencyApplies, false);
  assert.ok(close(r.weights.citation / r.weights.recency, 7));
});

test('Saaty olcegine yuvarlama ve yargi dili', () => {
  assert.equal(snapToSaaty(4.4), 4);
  assert.equal(snapToSaaty(40), 9);
  assert.equal(describeJudgment('citation', 'recency', 1 / 5, 'tr'), 'güncellik, atıf yoğunluğu kriterinden belirgin şekilde daha önemli');
  assert.equal(describeJudgment('citation', 'recency', 1 / 5), 'recency is clearly more important than citation impact', 'varsayilan dil Ingilizce');
});

test('Harker TAM matriste standart ozvektorle ayni: pyDecision referansi (ornek_4x4)', () => {
  // ahpCrossValidation.test.js ile ayni referans: pyDecision 5.1.1, wd='me'.
  const M = [[1, 1 / 3, 1 / 5, 1], [3, 1, 1 / 2, 2], [5, 2, 1, 4], [1, 1 / 2, 1 / 4, 1]];
  const edges = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) edges.push({ i, j, value: M[i][j] });
  const { weights } = harkerWeights(4, edges);
  [0.1033200344, 0.2672215363, 0.5087127983, 0.120745631].forEach((ref, i) =>
    assert.ok(Math.abs(weights[i] - ref) < 1e-8, `w[${i}] ${weights[i]}`));
});

test('agac (n-1 yanit): agirlik oranlari yol boyunca carpim, CR uygulanmaz', () => {
  // citation=3*keyword, keyword=2*quality -> citation=6*quality (tamamlama)
  const r = evaluateComparisons([
    { a: 'citation', b: 'keyword', value: 3 },
    { a: 'keyword', b: 'quality', value: 2 },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.consistencyApplies, false, 'agacta CR bir sey olcmez');
  assert.ok(close(r.weights.citation / r.weights.keyword, 3));
  assert.ok(close(r.weights.citation / r.weights.quality, 6));
});

test('baglanmayan kriterler hata verir ve gruplari soyler', () => {
  const r = evaluateComparisons([
    { a: 'citation', b: 'keyword', value: 3 },
    { a: 'recency', b: 'oa', value: 2 },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.groups.length, 2);
});

test('7 kriterin hepsi, 9 soru, tutarli yanitlar: CR anlamli ve dusuk, saf AHP agirligi', () => {
  const s = { citation: 8, keyword: 8, quality: 8, similarity: 4, recency: 4, reliability: 4, oa: 2 };
  const pairs = [['citation', 'keyword'], ['keyword', 'quality'], ['quality', 'similarity'], ['similarity', 'recency'],
    ['recency', 'reliability'], ['reliability', 'oa'], ['citation', 'quality'], ['keyword', 'recency'], ['quality', 'oa']];
  const r = evaluateComparisons(pairs.map(([a, b]) => ({ a, b, value: s[a] / s[b] })));
  assert.equal(r.ok, true);
  assert.equal(r.consistencyApplies, true);
  assert.ok(r.consistencyRatio < 0.01, `CR ${r.consistencyRatio}`);
  assert.equal(r.criteriaCovered.length, 7);
  assert.ok(close(sum(r.weights), 1));
  assert.ok(close(r.weights.citation / r.weights.oa, 4));
});

test('kismi kapsam: gecmeyen kriterler varsayilan payini korur', () => {
  const r = evaluateComparisons([
    { a: 'citation', b: 'recency', value: 3 },
    { a: 'recency', b: 'oa', value: 1 },
  ]);
  assert.ok(close(sum(r.weights), 1));
  for (const c of CRITERIA.filter((x) => !['citation', 'recency', 'oa'].includes(x))) {
    assert.ok(close(r.weights[c], DEFAULT_WEIGHTS[c]), `${c} degismemeli`);
  }
});

test('dongusel celiski: hangi yanitin celistigi ve diger yanitlarin ne dedigi duz dille', () => {
  const r = evaluateComparisons([
    { a: 'recency', b: 'citation', value: 7 },
    { a: 'citation', b: 'quality', value: 3 },
    { a: 'quality', b: 'recency', value: 3 },
  ], { allowedValues: UI, lang: 'tr' });
  assert.equal(r.isConsistent, false);
  assert.match(r.inconsistency.explanation, /dedin; diğer cevapların ise/);
  assert.doesNotMatch(r.inconsistency.explanation, /yanlış|hata/i);
  assert.ok(UI.some((v) => close(v, r.inconsistency.suggestion.value, 1e-9)), 'oneri arayuzde secilebilir olmali');
});

test('GARANTI: "duzeltir" denen her oneri gercekten duzeltir (5 secenekle tum 3lu kombinasyonlar)', () => {
  let fixable = 0; let fixed = 0; let total = 0;
  for (const x of UI) for (const y of UI) for (const z of UI) {
    const j = [{ a: 'recency', b: 'citation', value: x }, { a: 'citation', b: 'quality', value: y }, { a: 'recency', b: 'quality', value: z }];
    const r = evaluateComparisons(j, { allowedValues: UI });
    if (r.isConsistent) continue;
    total++;
    const s = r.inconsistency.suggestion;
    if (!s.fixesIt) continue;
    fixable++;
    const j2 = j.map((q) => (q.a === s.a && q.b === s.b ? { ...q, value: s.value } : q.a === s.b && q.b === s.a ? { ...q, value: 1 / s.value } : q));
    if (evaluateComparisons(j2, { allowedValues: UI }).isConsistent) fixed++;
  }
  assert.ok(total > 0 && fixable > 0);
  assert.equal(fixed, fixable);
});

test('ayni cift iki kez gelirse sonuncusu gecerli; gecersiz girdi yok sayilir', () => {
  const r = evaluateComparisons([
    { a: 'citation', b: 'oa', value: 9 },
    { a: 'oa', b: 'citation', value: 1 },
    { a: 'bogus', b: 'oa', value: 3 },
    { a: 'citation', b: 'citation', value: 3 },
  ]);
  assert.equal(r.answered, 1);
  assert.ok(close(r.weights.citation, r.weights.oa));
});

test('bos girdi', () => {
  assert.equal(evaluateComparisons([]).ok, false);
});

test('ikili celiski aciklamasi Ingilizce de uretilir', () => {
  const r = evaluateComparisons([
    { a: 'recency', b: 'citation', value: 7 },
    { a: 'citation', b: 'quality', value: 3 },
    { a: 'quality', b: 'recency', value: 3 },
  ], { allowedValues: UI, lang: 'en' });
  assert.match(r.inconsistency.explanation, /^You said ".+"; your other answers suggest ".+"\.$/);
  assert.doesNotMatch(r.inconsistency.explanation + r.inconsistency.suggestion.text, /[çğıöşü]/i, 'Ingilizce metinde Turkce harf olmamali');
});
