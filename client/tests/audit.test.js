import test from 'node:test';
import assert from 'node:assert/strict';

import { citedDois, countBySeverity, groupItems, packageStatus, runAudit, SEVERITY } from '../src/audit/audit.js';
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

// --- WO-011 Faz 3 ---

test('bos bolum: taslakta bilgi, teslimde zorunlu bolum uyari, istege bagli bolum bilgi', () => {
  const headings = [
    { index: 0, text: 'Giriş', key: 'intro', total: 0 },
    { index: 1, text: 'Kısaltmalar', key: 'abbreviations', total: 0 },
  ];
  const draft = runAudit(snapshot({ headings }), { stage: 'draft' }).filter((i) => i.rule === 'emptySection');
  assert.deepEqual(draft.map((i) => i.severity), ['info', 'info']);
  const submit = runAudit(snapshot({ headings }), { stage: 'submit' }).filter((i) => i.rule === 'emptySection');
  assert.deepEqual(submit.map((i) => [i.params.name, i.severity]), [['Giriş', 'warning'], ['Kısaltmalar', 'info']]);
});

test('kunye eksik kaynak: atif yapilansa uyari, yalniz sepettese bilgi', () => {
  const NOYEAR = { title: 'Yılsız rapor', creator: 'Ece Kara', doi: '10.1/kara' };
  const NOTITLE = { title: '', creator: 'Canan Akdoğan', year: 2021 };
  const items = runAudit(snapshot({ body: 'X (Kara, t.y.). Y (Akdoğan, 2021). Z (Kaya, 2020).', papers: [NOYEAR, KAYA, NOTITLE] }));
  const incomplete = items.filter((i) => i.rule === 'incompleteSource');
  assert.deepEqual(incomplete.map((i) => [i.params.fields, i.severity]), [[['title'], 'warning'], [['year'], 'info']]);
});

test('tablo ve sekil numaralandirmasi: sira atlayan baslik ve basligi olmayan gonderme', () => {
  const blocks = [
    { tag: 'P', text: 'Tablo 1. Deney koşulları', key: 'k1' },
    { tag: 'P', text: 'Tablo 3. Sonuçlar', key: 'k2' },
    { tag: 'P', text: "Sonuçlar Tablo 3'te ve Şekil 2'de görülüyor; Tablo 1 de önemli.", key: 'k3' },
    { tag: 'P', text: 'Şekil 1: Düzenek', key: 'k4' },
  ];
  const items = runAudit(snapshot({ blocks }));
  const order = items.filter((i) => i.rule === 'captionOrder');
  assert.deepEqual(order.map((i) => [i.params.kind, i.params.n, i.params.expected]), [['table', 3, 2]]);
  const missing = items.filter((i) => i.rule === 'captionMissing');
  assert.deepEqual(missing.map((i) => [i.params.kind, i.params.n]), [['figure', 2]]);
  assert.deepEqual(missing[0].target, { kind: 'sentence', key: 'k3' });
  // Düzgün numaralı belge temiz
  const clean = runAudit(snapshot({ blocks: [blocks[0], { tag: 'P', text: 'Bkz. Tablo 1.', key: 'k5' }] }));
  assert.ok(!rules(clean).some((r) => r.startsWith('caption')));
});

test('ayni kuraldan maddeler gruplanir, sira korunur', () => {
  const items = runAudit(snapshot({
    headings: [
      { index: 0, text: 'Giriş', total: 0 }, { index: 1, text: 'Yöntem', total: 0 }, { index: 2, text: 'Bulgular', total: 0 },
    ],
    sentences: [{ text: 'Pasif sistemler riski azaltır.', mark: MARK.uncited }],
  }));
  const groups = groupItems(items);
  const empty = groups.find((g) => g.rule === 'emptySection');
  assert.equal(empty.items.length, 3);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), items.length);
  assert.equal(new Set(groups.map((g) => g.id)).size, groups.length);
});

test('tez paketi: var, basligi var ama bos, yok', () => {
  const names = { cover: 'Kapak', approval: 'Onay sayfası', ethics: 'Etik beyan', ozet: 'Özet', abstract: 'Abstract', contents: 'İçindekiler', tableList: 'Tablolar listesi', figureList: 'Şekiller listesi', appendix: 'Ekler' };
  const status = packageStatus([
    { index: 0, key: 'cover', text: 'Kapak', total: 12 },
    { index: 1, key: null, text: 'Özet', total: 0 },
    { index: 2, key: 'abstract', text: 'Abstract', total: 150 },
  ], (k) => names[k]);
  const byKey = Object.fromEntries(status.map((s) => [s.key, s.status]));
  assert.equal(byKey.cover, 'present');
  assert.equal(byKey.ozet, 'empty', 'kimliksiz başlık adla bulunur');
  assert.equal(byKey.abstract, 'present');
  assert.equal(byKey.approval, 'missing');
  assert.equal(status.length, 9);
});
