import test from 'node:test';
import assert from 'node:assert/strict';

import { citedDois, countBySeverity, runAudit, SEVERITY } from '../src/audit/audit.js';
import { matchSources } from '../src/components/workspace/references.js';
import { MARK, sentenceKey } from '../src/components/workspace/claimDetection.js';

const KAYA = { title: 'Doğal dolaşım deneyleri', creator: 'Zeynep Kaya', year: 2020, doi: '10.1/kaya' };
const ARSLAN = { title: 'Pasif güvenlik', creator: 'Ahmet Arslan', year: 2019, doi: '10.1/arslan' };
const DEMIR = { title: 'Okunmamış kaynak', creator: 'Ali Demir', year: 2018 };

/** Belge özetini Workspace'in ürettiği biçimde kurar. */
function snapshot({ body = '', sentences = [], blocks = [], headings = [], refs = { present: false, lines: [] }, papers = [KAYA, ARSLAN, DEMIR] } = {}) {
  return {
    papers,
    match: matchSources(body, papers),
    sentences: sentences.map((s) => ({ key: sentenceKey(s.text), ...s })),
    blocks,
    outline: { headings, words: 0 },
    refs,
    setup: {},
  };
}

const rules = (items) => items.map((i) => i.rule);

test('bos ozet ya da temiz belge: madde yok', () => {
  assert.deepEqual(runAudit(null), []);
  const clean = snapshot({
    body: 'Doğal dolaşım kararlıdır (Kaya, 2020). Pasif sistemler güvenlidir (Arslan, 2019).',
    papers: [KAYA, ARSLAN],
    refs: { present: true, lines: ['Kaya, Z. (2020). Doğal dolaşım deneyleri.', 'Arslan, A. (2019). Pasif güvenlik.'] },
  });
  assert.deepEqual(runAudit(clean, { retractions: { '10.1/kaya': { status: 'none' }, '10.1/arslan': { status: 'none' } } }), []);
});

test('geri cekilmis ve endise bildirimli kaynak kritik', () => {
  const s = snapshot({ body: 'A (Kaya, 2020). B (Arslan, 2019).', refs: { present: true, lines: ['Kaya 2020', 'Arslan 2019'] } });
  const items = runAudit(s, { retractions: { '10.1/kaya': { status: 'retracted' }, '10.1/arslan': { status: 'concern' } } });
  assert.deepEqual(rules(items).slice(0, 2).sort(), ['concern', 'retracted']);
  assert.ok(items.slice(0, 2).every((i) => i.severity === 'critical'));
});

test('sepette karsiligi olmayan atif kritik ve cumleye baglanir', () => {
  const text = 'Bu bulgu tekrarlanmıştır (Yılmaz, 2023).';
  const items = runAudit(snapshot({ body: text, sentences: [{ text, mark: MARK.cited }] }));
  const orphan = items.find((i) => i.rule === 'orphan');
  assert.equal(orphan.severity, 'critical');
  assert.equal(orphan.params.citation, 'Yılmaz, 2023');
  assert.deepEqual(orphan.target, { kind: 'sentence', key: sentenceKey(text) });
});

test('atif var kaynakca bolumu yok: kritik', () => {
  const items = runAudit(snapshot({ body: 'X (Kaya, 2020).' }));
  assert.ok(rules(items).includes('noReferences'));
  assert.equal(items.find((i) => i.rule === 'noReferences').params.n, 1);
});

test('kaynakca var ama atif yapilan kaynak icinde yok: kritik', () => {
  const items = runAudit(snapshot({
    body: 'X (Kaya, 2020). Y (Arslan, 2019).',
    refs: { present: true, lines: ['Kaya, Z. (2020). Doğal dolaşım deneyleri.'] },
  }));
  const missing = items.filter((i) => i.rule === 'notInReferences');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].params.title, ARSLAN.title);
});

test('kaynakca karsilastirmasi Turkce harf ve buyuk-kucuk harf farkini asiyor', () => {
  const ozturk = { title: 'T', creator: 'Ayşe Öztürk', year: 2021 };
  const items = runAudit(snapshot({
    papers: [ozturk],
    body: 'Sonuç (Öztürk, 2021).',
    refs: { present: true, lines: ['OZTURK, A. (2021). T.'] },
  }));
  assert.ok(!rules(items).includes('notInReferences'), JSON.stringify(items));
});

test('atif isareti olmayan iddia uyari; "dogrulanmamis" denmiyor', () => {
  const text = 'Pasif sistemler kaza riskini yüzde 94 azaltır.';
  const items = runAudit(snapshot({ sentences: [{ text, mark: MARK.uncited }, { text: 'Bu bölümde yöntem anlatılıyor.', mark: MARK.notClaim }] }));
  const claim = items.filter((i) => i.rule === 'uncitedClaim');
  assert.equal(claim.length, 1);
  assert.equal(claim[0].severity, 'warning');
  assert.equal(claim[0].excerpt, text);
  assert.ok(!rules(items).some((r) => /verif|dogrula/i.test(r)));
});

test('dogrudan alintida sayfa numarasi yoksa uyari; varsa yok', () => {
  const key = 'k1';
  const without = runAudit(snapshot({
    body: '“Passive decay heat removal was maintained for 72 hours” (Kaya, 2020).',
    blocks: [{ tag: 'P', text: '“Passive decay heat removal was maintained for 72 hours” (Kaya, 2020).', key }],
  }));
  const quote = without.find((i) => i.rule === 'quoteNoPage');
  assert.ok(quote);
  assert.deepEqual(quote.target, { kind: 'sentence', key });

  for (const page of ['(Kaya, 2020, s. 45)', '(Kaya, 2020, p. 12)', '(Kaya, 2020, ss. 3-5)']) {
    const text = `“Passive decay heat removal was maintained for 72 hours” ${page}.`;
    const items = runAudit(snapshot({ body: text, blocks: [{ tag: 'P', text, key }] }));
    assert.ok(!rules(items).includes('quoteNoPage'), page);
  }
  // Atıfsız tırnak (ör. terim vurgusu) alıntı sayılmaz
  const term = '“doğal dolaşım” kavramı burada kullanılmaktadır';
  assert.ok(!rules(runAudit(snapshot({ blocks: [{ tag: 'P', text: term, key }] }))).includes('quoteNoPage'));
  // "Alıntıla" düğmesinin eklediği blok alıntı
  const block = runAudit(snapshot({ body: 'Kısa (Kaya, 2020)', blocks: [{ tag: 'BLOCKQUOTE', text: 'Kısa metin (Kaya, 2020)', key }] }));
  assert.ok(rules(block).includes('quoteNoPage'));
});

test('bos bolum uyari; kaynakca basligi bos olsa da bu kurala girmez', () => {
  const items = runAudit(snapshot({
    headings: [
      { index: 0, level: 1, text: 'Giriş', words: 0, total: 0, target: 400 },
      { index: 1, level: 1, text: 'Yöntem', words: 120, total: 120, target: 0 },
      { index: 2, level: 1, text: 'Kaynakça', words: 0, total: 0, target: 0 },
    ],
  }));
  const empty = items.filter((i) => i.rule === 'emptySection');
  assert.equal(empty.length, 1);
  assert.equal(empty[0].params.name, 'Giriş');
  assert.deepEqual(empty[0].target, { kind: 'section', index: 0 });
});

test('kelime hedefi: yarisinin alti ve bir bucuk katinin ustu bilgi', () => {
  const items = runAudit(snapshot({
    headings: [
      { index: 0, text: 'Özet', total: 100, target: 250 },
      { index: 1, text: 'Giriş', total: 700, target: 400 },
      { index: 2, text: 'Yöntem', total: 500, target: 600 },
    ],
  }));
  assert.deepEqual(items.filter((i) => i.severity === 'info' && /Target/.test(i.rule)).map((i) => [i.rule, i.params.name]),
    [['underTarget', 'Özet'], ['overTarget', 'Giriş']]);
});

test('atif yapilmayan sepet kaynagi tek bilgi maddesi', () => {
  const items = runAudit(snapshot({ body: 'X (Kaya, 2020).', refs: { present: true, lines: ['Kaya 2020'] } }));
  const uncited = items.find((i) => i.rule === 'uncitedSources');
  assert.equal(uncited.params.n, 2);
  assert.deepEqual(uncited.params.titles, [ARSLAN.title, DEMIR.title]);
});

test('geri cekme durumu bilinmeyen kaynak temiz sayilmaz', () => {
  const s = snapshot({ body: 'X (Kaya, 2020). Y (Arslan, 2019).', refs: { present: true, lines: ['Kaya 2020', 'Arslan 2019'] } });
  assert.deepEqual(citedDois(s), ['10.1/kaya', '10.1/arslan']);
  const partial = runAudit(s, { retractions: { '10.1/kaya': { status: 'none' }, '10.1/arslan': { status: 'unknown' } } });
  assert.equal(partial.find((i) => i.rule === 'retractionUnknown').params.n, 1);
  const failed = runAudit(s, { retractionFailed: true });
  assert.equal(failed.find((i) => i.rule === 'retractionUnknown').params.n, 2);
  // Cevap henüz gelmediyse (null) madde üretilmez: "bilinmiyor" değil "bekleniyor"
  assert.ok(!rules(runAudit(s)).includes('retractionUnknown'));
});

test('maddeler onem sirasinda; sayilar ve kimlikler tutarli', () => {
  const text = 'Pasif sistemler kaza riskini azaltır.';
  const items = runAudit(snapshot({
    body: 'X (Yılmaz, 2023).',
    sentences: [{ text, mark: MARK.uncited }],
    headings: [{ index: 0, text: 'Özet', total: 10, target: 250 }],
  }));
  const order = items.map((i) => SEVERITY.indexOf(i.severity));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const counts = countBySeverity(items);
  assert.equal(counts.critical + counts.warning + counts.info, items.length);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'kimlikler tekil');
});

test('modul saf: ag, DOM ve depolama kullanmiyor', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/audit/audit.js', import.meta.url), 'utf8');
  assert.ok(!/\b(fetch|axios|localStorage|document\.|window\.)/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
});
