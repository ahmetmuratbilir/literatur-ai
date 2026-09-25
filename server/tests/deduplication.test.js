import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deduplicateResults,
  calculateRelevanceScore,
  toTokenSet,
} from '../services/searchRankingService.js';

function paper(overrides = {}) {
  return {
    title: 'Passive cooling strategies for small modular reactors',
    abstract: '',
    doi: '',
    source: 'Crossref',
    sourceList: [overrides.source || 'Crossref'],
    yearConfidence: 'high',
    publicationYear: 2022,
    ...overrides,
  };
}

test('ayni DOI farkli basliklarla gelse bile tek kayda iner', () => {
  const results = [
    paper({
      doi: '10.1000/reactor-1',
      title: 'Passive cooling strategies for small modular reactors',
      source: 'Crossref',
      sourceList: ['Crossref'],
    }),
    paper({
      // Ayni makale, ama kaynak alt basligi da ekliyor: Jaro-Winkler 0.95'i gecmez.
      doi: 'https://doi.org/10.1000/REACTOR-1',
      title: 'Passive cooling strategies for small modular reactors: a systematic review of thermal margins',
      source: 'OpenAlex',
      sourceList: ['OpenAlex'],
    }),
  ];

  const unique = deduplicateResults(results);

  assert.equal(unique.length, 1, 'DOI esitligi baslik farkina ragmen yakalanmali');
  assert.deepEqual(unique[0].sourceList.sort(), ['Crossref', 'OpenAlex']);
});

test('DOI once baslikla eslesen bir kayda baglandiginda sonraki kopyalar da bulunur', () => {
  const results = [
    paper({ title: 'Thermal margin analysis in SMR cores', source: 'Crossref', sourceList: ['Crossref'] }),
    paper({
      title: 'Thermal margin analysis in SMR cores',
      doi: '10.1000/smr-9',
      source: 'OpenAlex',
      sourceList: ['OpenAlex'],
    }),
    paper({
      title: 'Completely different wording about margins and cores in reactors today',
      doi: '10.1000/smr-9',
      source: 'Scopus',
      sourceList: ['Scopus'],
    }),
  ];

  const unique = deduplicateResults(results);

  assert.equal(unique.length, 1);
  assert.deepEqual(unique[0].sourceList.sort(), ['Crossref', 'OpenAlex', 'Scopus']);
});

test('birlestirme daha zengin ozeti ve yuksek atif sayisini korur', () => {
  const longAbstract = 'Bu calisma pasif sogutma stratejilerini kapsamli bicimde inceler. '.repeat(4);

  const results = [
    paper({
      doi: '10.1000/merge-1',
      abstract: '',
      citedBy: 3,
      url: '',
      source: 'Crossref',
      sourceList: ['Crossref'],
    }),
    paper({
      doi: '10.1000/merge-1',
      abstract: longAbstract,
      citedBy: 140,
      url: 'https://example.org/full',
      quartile: 'Q1',
      source: 'OpenAlex',
      sourceList: ['OpenAlex'],
    }),
  ];

  const [merged] = deduplicateResults(results);

  assert.equal(merged.abstract, longAbstract, 'dolu ozet bos ozetin yerini almali');
  assert.equal(merged.description, longAbstract);
  assert.equal(merged.citedBy, 140, 'en yuksek atif sayisi korunmali');
  assert.equal(merged.url, 'https://example.org/full', 'eksik alan tamamlanmali');
  assert.equal(merged.quartile, 'Q1');
});

test('birlestirme mevcut dolu alanin uzerine daha fakir veriyle yazmaz', () => {
  const rich = 'Dolu ve uzun bir ozet metni burada yer aliyor ve bilgi tasiyor.';

  const results = [
    paper({ doi: '10.1000/keep-1', abstract: rich, citedBy: 90, sourceList: ['OpenAlex'], source: 'OpenAlex' }),
    paper({ doi: '10.1000/keep-1', abstract: 'kisa', citedBy: 2, sourceList: ['DOAJ'], source: 'DOAJ' }),
  ];

  const [merged] = deduplicateResults(results);

  assert.equal(merged.abstract, rich);
  assert.equal(merged.citedBy, 90);
});

test('cok farkli uzunluktaki basliklar birlestirilmez', () => {
  const results = [
    paper({ title: 'Reactor safety', doi: '' }),
    paper({ title: 'Reactor safety analysis under extended station blackout conditions in generation IV designs', doi: '' }),
  ];

  assert.equal(deduplicateResults(results).length, 2);
});

test('token esleсmesi alt-dize yanlis pozitifi uretmez', () => {
  const tokens = toTokenSet('The reactor reaction was active');

  assert.equal(tokens.has('reactor'), true);
  assert.equal(tokens.has('act'), false, '"act" bagimsiz bir token degil');
  assert.equal(tokens.has('ion'), false, '"ion" bagimsiz bir token degil');
});

test('relevance skoru alt-dize eslesmesiyle sismez', () => {
  const unrelated = {
    title: 'Interaction of factors in abstract contract theory',
    abstract: 'This transaction framework discusses contractual reactions in abstraction.',
  };
  const related = {
    title: 'Reactor core thermal analysis',
    abstract: 'A study of reactor core behaviour under thermal load.',
  };

  const unrelatedScore = calculateRelevanceScore(unrelated, 'reactor core', []);
  const relatedScore = calculateRelevanceScore(related, 'reactor core', []);

  assert.ok(
    relatedScore > unrelatedScore,
    `alakali makale daha yuksek skor almali (alakali=${relatedScore}, alakasiz=${unrelatedScore})`
  );
});
