import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreChunksByKeywords } from '../services/ragService.js';

const PROMPT = 'reactor core cooling';
const CURRENT_YEAR = new Date().getFullYear();

// Yaşa göre yıl üretiyoruz ki testler takvim ilerledikçe kaymasın.
function chunk({ id, age, title, body }) {
  return {
    sourceIndex: id,
    year: String(CURRENT_YEAR - age),
    title,
    authors: 'Doe',
    chunkText: body,
  };
}

// Gerçekçi durum: chunk bir abstract'ın ortasından gelir, başlık sorgu
// kelimelerini tekrarlamaz. Eşleşme mütevazıdır — eski kodda yaş cezası
// (yaş * 0.1) bu skoru negatife düşürüp chunk'ı tamamen eliyordu.
const FOUNDATIONAL_PAPER = chunk({
  id: 1,
  age: 61,
  title: 'Thermal hydraulics of pressurized systems',
  body: 'The core cooling margin was evaluated under transient conditions.',
});

const RECENT_WEAK_PAPER = chunk({
  id: 2,
  age: 0,
  title: 'Modern grid integration',
  body: 'A reactor is mentioned once in passing.',
});

test('altmis yillik alakali kaynak baglamdan tamamen elenmez', () => {
  const selected = scoreChunksByKeywords([FOUNDATIONAL_PAPER, RECENT_WEAK_PAPER], PROMPT, 12);
  const ids = selected.map((c) => c.sourceIndex);

  assert.ok(
    ids.includes(1),
    'yas cezasi tek basina alakali bir chunk\'i baglam disina atmamali'
  );
  assert.equal(selected.length, 2);
});

test('alaka guncellikten baskin gelir', () => {
  const selected = scoreChunksByKeywords([FOUNDATIONAL_PAPER, RECENT_WEAK_PAPER], PROMPT, 12);

  assert.equal(
    selected[0].sourceIndex,
    1,
    'daha alakali eski kaynak, zayif alakali guncel kaynaktan once gelmeli'
  );
});

test('cok eski bir chunk tek basina yas yuzunden negatife dusmez', () => {
  const [selected] = scoreChunksByKeywords(
    [chunk({ id: 1, age: 66, title: 'Loop design', body: 'Reactor core cooling loop description.' })],
    PROMPT,
    12
  );

  assert.ok(selected.score > 0, `skor pozitif kalmali, ${selected.score} bulundu`);
});

test('esit alakada guncel olan hala tercih edilir', () => {
  const body = 'Reactor core cooling is examined here.';
  const selected = scoreChunksByKeywords(
    [
      chunk({ id: 1, age: 36, title: 'T', body }),
      chunk({ id: 2, age: 0, title: 'T', body }),
    ],
    PROMPT,
    12
  );

  assert.equal(selected[0].sourceIndex, 2, 'esit alakada guncel olan one gecmeli');
  assert.equal(selected[1].sourceIndex, 1);
});

test('guncellik cezasi ust sinirla kapali kalir', () => {
  const body = 'Reactor core cooling is examined here.';
  const [young] = scoreChunksByKeywords([chunk({ id: 1, age: 0, title: 'T', body })], PROMPT, 12);
  const [ancient] = scoreChunksByKeywords([chunk({ id: 2, age: 120, title: 'T', body })], PROMPT, 12);

  const ratio = ancient.score / young.score;
  assert.ok(ratio >= 0.7 - 1e-9, `ceza %30'u gecmemeli, oran ${ratio.toFixed(3)} bulundu`);
  assert.ok(ancient.score > 0);
});

test('alakasiz chunk hala elenir', () => {
  const selected = scoreChunksByKeywords(
    [
      chunk({ id: 1, age: 0, title: 'T', body: 'Reactor core cooling analysis.' }),
      chunk({ id: 2, age: 0, title: 'Bakery logistics', body: 'Completely different topic about bread delivery.' }),
    ],
    PROMPT,
    12
  );

  assert.equal(selected.length, 1, 'anahtar kelime eslesmeyen chunk elenmeli');
  assert.equal(selected[0].sourceIndex, 1);
});

test('yil bilgisi olmayan chunk cezalandirilmaz', () => {
  const body = 'Reactor core cooling is examined here.';
  const selected = scoreChunksByKeywords(
    [
      { sourceIndex: 1, year: 'n.d.', title: 'T', authors: 'A', chunkText: body },
      chunk({ id: 2, age: 0, title: 'T', body }),
    ],
    PROMPT,
    12
  );

  assert.equal(selected.length, 2);
  assert.equal(selected[0].score, selected[1].score, 'yil yoksa ceza uygulanmamali');
});
