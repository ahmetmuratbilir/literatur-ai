import test from 'node:test';
import assert from 'node:assert/strict';

import {
  searchText, tokenizeBoolean, isWellFormed,
  forDoaj, forArxiv, forSemanticScholar, forCrossref, forOpenAlex,
  buildSourceQueries, scoringInput,
} from '../services/sourceQuery.js';

// KURAL: arama her zaman Ingilizce. Turkce ozgun metin planda kalir (DergiPark
// icin) ama hicbir mevcut kaynaga gonderilmez.
const PLAN = {
  phrases: [{ original: 'nükleer reaktör güvenliği', translated: 'nuclear reactor safety' }],
  terms: ['nükleer reaktör güvenliği', 'nuclear reactor safety'],
};

const MULTI = {
  phrases: [
    { original: 'nükleer reaktör', translated: 'nuclear reactor' },
    { original: 'pasif güvenlik', translated: 'passive safety' },
  ],
};

const AI = '("nuclear reactor" OR "fission reactor") AND (safety OR "risk assessment")';
const AI_PLAN = { phrases: [{ original: AI, translated: null, boolean: true }] };

test('hicbir kaynaga Turkce gonderilmez', () => {
  const all = buildSourceQueries(PLAN);
  for (const [source, q] of Object.entries(all)) {
    assert.ok(!/[çğıöşüÇĞİÖŞÜ]/.test(q), `${source} sorgusunda Turkce var: ${q}`);
  }
});

test('ceviri yoksa ozgun metin kullanilir (kullanici zaten Ingilizce yazmis)', () => {
  assert.equal(searchText({ original: 'graphene oxide', translated: null }), 'graphene oxide');
});

test('kisa ifade tam ifade olarak aranir', () => {
  assert.equal(forDoaj(PLAN), '"nuclear reactor safety"');
  assert.equal(forOpenAlex(PLAN), '"nuclear reactor safety"');
  assert.equal(forArxiv(PLAN), 'all:"nuclear reactor safety"');
});

test('uzun ifade tam ifade olarak ARANMAZ (neredeyse hic sonuc dondurmez)', () => {
  const long = { phrases: [{ original: 'x', translated: 'deep learning based fault detection in nuclear power plants' }] };
  assert.ok(!forOpenAlex(long).startsWith('"'), forOpenAlex(long));
  assert.match(forArxiv(long), /all:deep AND all:learning/);
});

test('birden fazla ifade AND ile baglanir', () => {
  assert.equal(forDoaj(MULTI), '"nuclear reactor" AND "passive safety"');
  assert.equal(forArxiv(MULTI), 'all:"nuclear reactor" AND all:"passive safety"');
});

test('S2 ve Crossref: operatorsuz Ingilizce duz metin', () => {
  assert.equal(forSemanticScholar(PLAN), 'nuclear reactor safety');
  assert.equal(forCrossref(MULTI), 'nuclear reactor passive safety');
});

// --- M0 regresyonu: AI boolean sorgusu ---------------------------------------

test('REGRESYON: AI boolean sorgusu tek tirnakli diziye DONUSMEZ', () => {
  // M0 surumu bunu "( nuclear reactor OR fission reactor ) AND (...)" diye
  // tek bir tam ifadeye ceviriyordu; olculen: DOAJ 791 -> 0, OpenAlex -> 0.
  const q = forOpenAlex(AI_PLAN);
  assert.ok(!q.startsWith('"'), `boolean sorgu tirnaklanmamali: ${q}`);
  assert.equal(q, '(("nuclear reactor" OR "fission reactor") AND (safety OR "risk assessment"))');
  assert.equal(forDoaj(AI_PLAN), q);
});

test('AI sorgusu arXiv icin alan onekli ceviriliyor', () => {
  assert.equal(
    forArxiv(AI_PLAN),
    '((all:"nuclear reactor" OR all:"fission reactor") AND (all:safety OR all:"risk assessment"))'
  );
});

test('AI sorgusu S2/Crossref/skorlama icin duz kelimelere iniyor', () => {
  assert.equal(forSemanticScholar(AI_PLAN), 'nuclear reactor fission reactor safety risk assessment');
  assert.equal(scoringInput(AI_PLAN).text, 'nuclear reactor fission reactor safety risk assessment');
});

test('NOT: arXiv icin ANDNOT, duz metinden cikarilir', () => {
  const plan = { phrases: [{ original: 'reactor AND NOT fusion', boolean: true }] };
  assert.equal(forArxiv(plan), '(all:reactor ANDNOT all:fusion)');
  assert.equal(forSemanticScholar(plan), 'reactor');
});

test('yan yana terimler arasina acik AND konur', () => {
  const plan = { phrases: [{ original: '"nuclear reactor" safety', boolean: true }] };
  assert.equal(forOpenAlex(plan), '("nuclear reactor" AND safety)');
});

test('bozuk boolean (dengesiz parantez) duz aramaya duser, cokmez', () => {
  const plan = { phrases: [{ original: '("nuclear reactor" OR fission', boolean: true }] };
  assert.equal(isWellFormed(tokenizeBoolean(plan.phrases[0].original)), false);
  assert.equal(forOpenAlex(plan), '(nuclear reactor fission)');
});

test('kucuk harfli and/or operator degil kelimedir', () => {
  assert.deepEqual(tokenizeBoolean('rock and roll').map((t) => t.type), ['word', 'word', 'word']);
});

test('bos plan her kaynakta bos dize', () => {
  const all = buildSourceQueries({ phrases: [] });
  for (const q of Object.values(all)) assert.equal(q, '');
});

test('tirnak enjeksiyonu duz ifadede temizlenir', () => {
  const q = forDoaj({ phrases: [{ original: 'test" OR x:"y', translated: null }] });
  assert.equal(q, '"test OR x: y"');
});

// --- Turkce kaynaklar: ozgun Turkce metinle arama ---
import { forTurkishSources } from '../services/sourceQuery.js';

test('turkish sources get the original Turkish text when the query was translated', () => {
  const plan = { phrases: [
    { original: 'yapay zeka', translated: 'artificial intelligence' },
    { original: 'eğitim', translated: 'education' },
  ] };
  assert.equal(forTurkishSources(plan), 'yapay zeka eğitim');
});

test('english queries trigger no extra Turkish search', () => {
  assert.equal(forTurkishSources({ phrases: [{ original: 'deep learning', translated: null }] }), null);
  assert.equal(forTurkishSources({ phrases: [{ original: 'AI', translated: 'ai' }] }), null);
});

test('other translated languages are not searched as Turkish', () => {
  assert.equal(forTurkishSources({ phrases: [{ original: 'künstliche Intelligenz straße', translated: 'ai road' }] }), null);
});

test('boolean AI queries are ignored for the Turkish search', () => {
  assert.equal(forTurkishSources({ phrases: [{ original: '"a" AND "b"', translated: null, boolean: true }] }), null);
});

test('relevance clauses accept the original Turkish phrase as an alternative', async () => {
  const { queryClauses } = await import('../services/sourceQuery.js');
  const clauses = queryClauses({ phrases: [{ original: 'yapay zeka', translated: 'artificial intelligence' }] });
  assert.deepEqual(clauses, [['artificial intelligence', 'yapay zeka']]);
  assert.deepEqual(queryClauses({ phrases: [{ original: 'deep learning', translated: null }] }), [['deep learning']]);
});
