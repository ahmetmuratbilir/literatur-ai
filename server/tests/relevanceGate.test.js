import test from 'node:test';
import assert from 'node:assert/strict';

import { relevanceGate, requiredMatches, toTokenSet } from '../services/searchRankingService.js';
import { calculateAHP } from '../services/ahp.js';
import { PROFILES } from '../services/ahpProfiles.js';

test('toTokenSet Turkce kelimeyi BOLMEZ (onceki surum "nükleer"i "nu"+"kleer" yapiyordu)', () => {
  const tokens = toTokenSet('Nükleer güvenlik öğretmen');
  assert.ok(tokens.has('nukleer'), [...tokens].join(','));
  assert.ok(tokens.has('guvenlik'));
  assert.ok(tokens.has('ogretmen'));
  assert.ok(!tokens.has('kleer'));
});

test('gereken eslesme sayisi', () => {
  assert.equal(requiredMatches(0), 0);
  assert.equal(requiredMatches(1), 1);
  assert.equal(requiredMatches(2), 2, 'iki kelimelik konuda ikisi de gecmeli');
  assert.equal(requiredMatches(3), 2);
  assert.equal(requiredMatches(6), 3);
});

const on = (id, matched, extra = {}) => ({ id, queryMatched: matched, queryTokenCount: 3, ...extra });

test('konu disi makale elenir, tam eslesenler kalir', () => {
  const g = relevanceGate([on('a', 3), on('b', 2), on('konu-disi', 0), on('zayif', 1)]);
  assert.equal(g.level, 'full');
  assert.deepEqual(g.items.map((i) => i.id), ['a', 'b']);
  assert.equal(g.dropped, 2);
});

test('tam eslesen yoksa kismi eslesenler gosterilir, hic eslesmeyen ASLA', () => {
  const g = relevanceGate([on('zayif', 1), on('konu-disi', 0)]);
  assert.equal(g.level, 'partial');
  assert.deepEqual(g.items.map((i) => i.id), ['zayif']);
});

test('olculemeyen veri (demo) esige girmez', () => {
  assert.equal(relevanceGate([{ id: 'x' }]).level, 'none');
});

test('CANLI VAKA: cok atifli konu disi makale "En cok atif alanlar" profilinde de gosterilmez', async () => {
  // "Global Linear Instability" (733 atif) sorgu "nuclear reactor safety" ile
  // 2. siraya cikiyordu.
  const Y = new Date().getFullYear();
  const common = { pubType: 'fla', sourceType: 'Journal', doi: '10.1/x', publicationYear: Y - 10, yearConfidence: 'high', queryTokenCount: 3 };
  const ranked = await calculateAHP([
    { ...common, id: 'konu-disi', citedBy: 733, keyCount: 3, expandedSimilarity: 0, queryMatched: 1 },
    { ...common, id: 'konu-ici-1', citedBy: 30, keyCount: 12, expandedSimilarity: 1, queryMatched: 3 },
    { ...common, id: 'konu-ici-2', citedBy: 5, keyCount: 9, expandedSimilarity: 0.66, queryMatched: 2 },
  ], PROFILES.atif.weights);
  assert.deepEqual(ranked.map((r) => r.id), ['konu-ici-1', 'konu-ici-2']);
  assert.ok(ranked.every((r) => r.matchLevel === 'full'));
});

test('AND yapisi: bir gruptan hic eslesmeyen makale elenir (canli LoRA vakasi)', async () => {
  const { queryClauses } = await import('../services/sourceQuery.js');
  const clauses = queryClauses({ phrases: [{ original: '("nuclear reactor" OR "fission reactor") AND (safety OR "risk assessment")', boolean: true }] });
  assert.deepEqual(clauses, [['nuclear reactor', 'fission reactor'], ['safety', 'risk assessment']]);

  const g = relevanceGate([
    { id: 'lora', queryMatched: 3, queryTokenCount: 6, clausesSatisfied: false },
    { id: 'reaktor-guvenlik', queryMatched: 3, queryTokenCount: 6, clausesSatisfied: true },
  ]);
  assert.deepEqual(g.items.map((i) => i.id), ['reaktor-guvenlik']);
});

test('duz konu + anahtar kelime: her biri ayri grup', async () => {
  const { queryClauses } = await import('../services/sourceQuery.js');
  assert.deepEqual(
    queryClauses({ phrases: [{ original: 'nükleer reaktör güvenliği', translated: 'nuclear reactor safety' }, { original: 'pasif soğutma', translated: 'passive cooling' }] }),
    // Ozgun Turkce metin ayni grupta alternatif (Turkce kaynaklar icin)
    [['nuclear reactor safety', 'nükleer reaktör güvenliği'], ['passive cooling', 'pasif soğutma']]
  );
});
