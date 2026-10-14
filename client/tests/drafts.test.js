import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDEX_KEY, LEGACY_KEY, createDraft, deleteDraft, duplicateDraft, loadIndex, readDraft,
  renameDraft, restoreDraft, setActive, wordsOf, writeDraft,
} from '../src/components/workspace/drafts.js';

/** Bellek içi localStorage taklidi. */
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    keys: () => [...map.keys()],
  };
}

let tick = 0;
const clock = () => ({ now: 1_700_000_000_000 + (tick += 1000), random: () => (tick % 997) / 997 });

test('bos depoda dizin bos', () => {
  assert.deepEqual(loadIndex(memoryStorage()), { activeId: null, items: [] });
});

test('eski tek belge kaybolmadan taslaga tasiniyor; eski anahtar silinmiyor', () => {
  const legacy = { html: '<h1>Giriş</h1><p>İki kelime burada.</p>', title: 'Eski tez', savedAt: 123, lastSection: { text: 'Giriş' } };
  const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify(legacy) });
  const index = loadIndex(storage, clock());
  assert.equal(index.migrated, true);
  assert.equal(index.items.length, 1);
  assert.equal(index.activeId, index.items[0].id);
  assert.deepEqual(readDraft(storage, index.activeId), legacy);
  assert.equal(index.items[0].title, 'Eski tez');
  assert.equal(index.items[0].section, 'Giriş');
  assert.ok(storage.getItem(LEGACY_KEY), 'eski anahtar duruyor');
  // İkinci okuma yeniden taşımaz
  const again = loadIndex(storage, clock());
  assert.equal(again.items.length, 1);
  assert.equal(again.migrated, undefined);
});

test('yeni taslak etkin olur; iki taslak arasinda gecis', () => {
  const storage = memoryStorage();
  const a = createDraft(storage, { title: 'Makale', html: '<p>a</p>' }, clock());
  const b = createDraft(storage, { title: 'Tez', html: '<p>b</p>' }, clock());
  assert.notEqual(a, b);
  assert.equal(loadIndex(storage).activeId, b);
  setActive(storage, a);
  assert.equal(loadIndex(storage).activeId, a);
  assert.equal(readDraft(storage, a).title, 'Makale');
  // Olmayan kimlik etkin yapılamaz
  setActive(storage, 'yok');
  assert.equal(loadIndex(storage).activeId, a);
});

test('kayit dizindeki ozeti guncelliyor', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { title: 'T', html: '' }, clock());
  writeDraft(storage, id, { title: 'Yeni ad', html: '<p>bir iki üç</p>', words: 3, lastSection: { text: 'Yöntem' }, savedAt: 99 });
  const meta = loadIndex(storage).items.find((d) => d.id === id);
  assert.deepEqual([meta.title, meta.words, meta.section, meta.savedAt], ['Yeni ad', 3, 'Yöntem', 99]);
});

test('yeniden adlandir, cogalt', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { title: 'Taslak', html: '<p>x</p>', setup: { size: 'a4' } }, clock());
  renameDraft(storage, id, '  Bitirme tezi  ');
  assert.equal(readDraft(storage, id).title, 'Bitirme tezi');
  const copy = duplicateDraft(storage, id, clock());
  assert.equal(readDraft(storage, copy).title, 'Bitirme tezi (kopya)');
  assert.deepEqual(readDraft(storage, copy).setup, { size: 'a4' });
  assert.equal(loadIndex(storage).activeId, id, 'kopya etkin olmaz');
  assert.equal(loadIndex(storage).items.length, 2);
});

test('sil ve geri al: icerik ve sira geri geliyor', () => {
  const storage = memoryStorage();
  const a = createDraft(storage, { title: 'A', html: '<p>a</p>' }, clock());
  const b = createDraft(storage, { title: 'B', html: '<p>b</p>' }, clock());
  const c = createDraft(storage, { title: 'C', html: '<p>c</p>' }, clock());
  const order = () => loadIndex(storage).items.map((d) => d.id);
  const before = order();
  const snapshot = deleteDraft(storage, b);
  assert.equal(readDraft(storage, b), null);
  assert.ok(!order().includes(b));
  restoreDraft(storage, snapshot);
  assert.deepEqual(order(), before);
  assert.equal(readDraft(storage, b).html, '<p>b</p>');
  // Etkin taslak silinince sıradaki etkin olur
  setActive(storage, c);
  deleteDraft(storage, c);
  assert.ok([a, b].includes(loadIndex(storage).activeId));
  assert.equal(deleteDraft(storage, 'yok'), null);
});

test('depolama doluysa yazma hata firlatir, sessizce yutulmaz', () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => writeDraft(storage, 'x', { html: '<p>a</p>' }), /Quota/);
});

test('bozuk dizin bos sayilir, cokmez', () => {
  const storage = memoryStorage({ [INDEX_KEY]: '{bozuk json' });
  assert.deepEqual(loadIndex(storage), { activeId: null, items: [] });
});

test('kelime sayimi etiketleri ve varliklari saymaz', () => {
  assert.equal(wordsOf('<h1>Giriş</h1><p>Bir&nbsp;iki <b>üç</b></p>'), 4);
  assert.equal(wordsOf(''), 0);
});
