import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDEX_KEY, LEGACY_KEY, createDraft, deleteDraft, duplicateDraft, loadIndex, readDraft,
  renameDraft, restoreDraft, setActive, wordsOf, writeDraft,
  LOCK_TTL, lockHolder, lockKey, readLock, releaseLock, saveConflictCopy, saveDraft, writeLock,
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

// --- Sekmeler arası (WO-011 Faz 1 ek) ---

test('surum denetimli kayit: ayni surumden yazar, araya yazilmissa yazmaz', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { html: '<p>Ortak</p>', title: 'T' }, clock());
  // İki sekme de rev 0'dan (eski kayıt) başlar.
  const a = saveDraft(storage, id, { html: '<p>Ortak AAA</p>', title: 'T' }, { baseRev: 0 });
  assert.equal(a.rev, 1);
  const b = saveDraft(storage, id, { html: '<p>Ortak BBB</p>', title: 'T' }, { baseRev: 0 });
  assert.equal(b.conflict, true);
  assert.equal(b.stored.html, '<p>Ortak AAA</p>');
  assert.equal(readDraft(storage, id).html, '<p>Ortak AAA</p>', 'A ezilmedi');
  const a2 = saveDraft(storage, id, { html: '<p>Ortak AAA 2</p>', title: 'T' }, { baseRev: 1 });
  assert.equal(a2.rev, 2);
});

test('baska sekmede silinen taslak kaydedilirse metin kaybolmaz', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { html: '<p>x</p>', title: 'Silinen' }, clock());
  deleteDraft(storage, id);
  const res = saveDraft(storage, id, { html: '<p>x y</p>', title: 'Silinen' }, { baseRev: 3 });
  assert.equal(res.rev, 4);
  assert.equal(readDraft(storage, id).html, '<p>x y</p>');
  assert.ok(loadIndex(storage).items.some((d) => d.id === id));
});

test('cakisma kopyasi ayri taslak olur, etkin taslak degismez', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { html: '<p>a</p>', title: 'Tez' }, clock());
  const copyId = saveConflictCopy(storage, id, { html: '<p>benim</p>', title: 'Tez' }, clock());
  assert.notEqual(copyId, id);
  assert.equal(readDraft(storage, copyId).title, 'Tez (çakışma kopyası)');
  assert.equal(readDraft(storage, copyId).html, '<p>benim</p>');
  assert.equal(loadIndex(storage).activeId, id);
});

test('kilit: sahibi, baskasi, suresi dolmus; yalniz sahibi birakir', () => {
  const storage = memoryStorage();
  writeLock(storage, 'd1', 'tabA', 1000);
  const lock = readLock(storage, 'd1');
  assert.equal(lockHolder(lock, 'tabA', 2000), 'self');
  assert.equal(lockHolder(lock, 'tabB', 2000), 'other');
  assert.equal(lockHolder(lock, 'tabB', 1000 + LOCK_TTL), 'none');
  assert.equal(lockHolder(null, 'tabB', 0), 'none');
  releaseLock(storage, 'd1', 'tabB');
  assert.ok(readLock(storage, 'd1'), 'başkasının kilidi bırakılmaz');
  releaseLock(storage, 'd1', 'tabA');
  assert.equal(readLock(storage, 'd1'), null);
});

test('yeniden adlandirma surumu artirir', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { html: '<p>a</p>', title: 'Eski' }, clock());
  saveDraft(storage, id, { html: '<p>a</p>', title: 'Eski' }, { baseRev: 0 });
  renameDraft(storage, id, 'Yeni');
  assert.equal(readDraft(storage, id).rev, 2);
  // Eski sürümden yazan sekme yeni adı ezmez.
  assert.equal(saveDraft(storage, id, { html: '<p>a</p>', title: 'Eski' }, { baseRev: 1 }).conflict, true);
});

test('silinen taslagin kilidi de silinir', () => {
  const storage = memoryStorage();
  const id = createDraft(storage, { html: '<p>a</p>' }, clock());
  writeLock(storage, id, 'tabA');
  deleteDraft(storage, id);
  assert.equal(storage.getItem(lockKey(id)), null);
});
