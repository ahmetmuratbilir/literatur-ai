import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRetraction, checkRetractions, annotateRetractions, normalizeDoi } from '../services/retraction.js';
import { calculateAHP } from '../services/ahp.js';
import { deduplicateResults, normalizeSearchResult } from '../services/searchRankingService.js';

// Fixture'lar 30 Eyl 2026'da Crossref'ten alinan GERCEK yanitlardan kisaltildi.
const WAKEFIELD = {
  DOI: '10.1016/s0140-6736(97)11096-0',
  'updated-by': [
    { DOI: '10.1016/s0140-6736(04)15715-2', type: 'correction', source: 'retraction-watch', updated: { 'date-parts': [[2004, 3, 6]] } },
    { DOI: '10.1016/s0140-6736(10)60175-4', type: 'retraction', source: 'retraction-watch', updated: { 'date-parts': [[2010, 2, 6]] } },
  ],
};

const MEHRA = {
  DOI: '10.1016/s0140-6736(20)31180-6',
  'updated-by': [
    { DOI: '10.1016/s0140-6736(20)31290-3', type: 'expression_of_concern', source: 'retraction-watch' },
    { DOI: '10.1016/s0140-6736(20)31249-6', type: 'correction', source: 'retraction-watch' },
    { DOI: '10.1016/s0140-6736(20)31174-0', type: 'retraction', source: 'publisher' },
    { DOI: '10.1016/s0140-6736(20)31528-2', type: 'erratum', source: 'publisher' },
  ],
  'update-to': [{ DOI: '10.1016/s0140-6736(20)31174-0', type: 'retraction', source: 'publisher' }],
};

test('ilk kayit correction olsa da listedeki retraction bulunur (Wakefield)', () => {
  // TUZAK: ilk kayda bakan kod bunu "duzeltme" sanar. Olculen gercek veri.
  const r = parseRetraction(WAKEFIELD);
  assert.equal(r.status, 'retracted');
  assert.equal(r.notices.length, 1, 'correction bildirim listesine girmemeli');
  assert.equal(r.notices[0].date, '2010-02-06');
  assert.equal(r.notices[0].source, 'retraction-watch');
});

test('karisik bildirimlerde en agir durum kazanir (Mehra/Surgisphere)', () => {
  const r = parseRetraction(MEHRA);
  assert.equal(r.status, 'retracted');
  assert.deepEqual(r.notices.map((n) => n.type).sort(), ['expression_of_concern', 'retraction']);
});

test('yalnizca update-to tasiyan kayit (bildirimin kendisi) geri cekilmis SAYILMAZ', () => {
  // update-to bildirimde durur ve orijinali gosterir. Ona bakmak bildirimi
  // "geri cekildi" diye isaretler.
  const notice = { DOI: '10.1016/s0140-6736(20)31174-0', 'update-to': [{ DOI: MEHRA.DOI, type: 'retraction' }] };
  assert.equal(parseRetraction(notice).status, 'none');
});

test('yalnizca duzeltme/erratum tasiyan makale temizdir', () => {
  const item = { 'updated-by': [{ type: 'correction' }, { type: 'erratum' }] };
  assert.equal(parseRetraction(item).status, 'none');
});

test('yalnizca endise bildirimi -> concern', () => {
  assert.equal(parseRetraction({ 'updated-by': [{ type: 'expression_of_concern' }] }).status, 'concern');
});

test('bos ve bozuk girdi cokmez', () => {
  assert.equal(parseRetraction(null).status, 'none');
  assert.equal(parseRetraction({ 'updated-by': 'bozuk' }).status, 'none');
});

test('DOI normalizasyonu', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1016/S0140-6736(97)11096-0'), '10.1016/s0140-6736(97)11096-0');
  assert.equal(normalizeDoi('doi:10.1038/NATURE12373'), '10.1038/nature12373');
});

function fakeFetch(itemsByCall, calls) {
  return async (url) => {
    calls.push(url);
    const next = itemsByCall.shift();
    if (next instanceof Error) throw next;
    if (next?.status) return { ok: false, status: next.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ message: { items: next || [] } }) };
  };
}

test('25 DOI iki batch istegine bolunur, buyuk/kucuk harf fark etmez', async () => {
  const dois = Array.from({ length: 25 }, (_, i) => `10.1234/TEST.${i}`);
  const calls = [];
  const { byDoi, checked } = await checkRetractions(dois, {
    fetchImpl: fakeFetch([[{ ...WAKEFIELD, DOI: '10.1234/test.3' }], []], calls),
    mailto: '',
  });
  assert.equal(checked, 25);
  assert.equal(calls.length, 2, '20 + 5');
  assert.equal(byDoi.get('10.1234/test.3').status, 'retracted');
  assert.ok(decodeURIComponent(calls[0]).includes('select=DOI,updated-by'));
});

test('ag hatasi aramayi dusurmez, hata raporlanir, sonuc unknown olur', async () => {
  const results = [{ doi: '10.1/a', title: 'x' }];
  const summary = await annotateRetractions(results, { fetchImpl: fakeFetch([new Error('ECONNRESET')], []), mailto: '' });
  assert.equal(summary.errors.length, 1);
  assert.equal(results[0].retraction.status, 'unknown', 'kanit yokken "geri cekilmemis" DENMEMELI');
});

test('bir batch basarisiz digeri basarili: basarisizdaki DOI none degil unknown', async () => {
  const results = Array.from({ length: 21 }, (_, i) => ({ doi: `10.9/x${i}` }));
  await annotateRetractions(results, {
    fetchImpl: fakeFetch([{ status: 503 }, [{ DOI: '10.9/x20' }]], []),
    mailto: '',
  });
  assert.equal(results[0].retraction.status, 'unknown');
  assert.equal(results[20].retraction.status, 'none');
});

test('crossref kaynagindan gelen retraction bilgisi icin tekrar sorulmaz', async () => {
  const calls = [];
  const results = [{ doi: '10.1/a', retraction: { status: 'none', notices: [] } }];
  await annotateRetractions(results, { fetchImpl: fakeFetch([], calls), mailto: '' });
  assert.equal(calls.length, 0);
});

test('tekillestirmede geri cekme bilgisi kaybolmaz', () => {
  const base = { title: 'Ileal-lymphoid-nodular hyperplasia and pervasive developmental disorder', doi: '10.1016/s0140-6736(97)11096-0' };
  const merged = deduplicateResults([
    normalizeSearchResult({ ...base, source: 'OpenAlex' }),
    normalizeSearchResult({ ...base, source: 'Crossref', retraction: parseRetraction(WAKEFIELD) }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].retraction.status, 'retracted');
});

test('AHP: yuksek atifli geri cekilmis makale gecerli makalenin altina iner ve uyari ilk sirada', async () => {
  const year = new Date().getFullYear() - 5;
  const common = { keyCount: 15, expandedSimilarity: 1, publicationYear: year, yearConfidence: 'high', pubType: 'ar', doi: '10.1/x', openAccess: true };
  const [first, second] = await calculateAHP([
    { ...common, id: 'geri-cekilmis', citedBy: 5000, retraction: { status: 'retracted', notices: [] } },
    { ...common, id: 'gecerli', citedBy: 10 },
  ]);
  assert.equal(first.id, 'gecerli');
  assert.equal(second.id, 'geri-cekilmis');
  assert.match(second.explanation[0], /GERİ ÇEKİLDİ/);
  assert.equal(second.scores.reliability, 0);
});
