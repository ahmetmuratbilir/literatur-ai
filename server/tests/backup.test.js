import test from 'node:test';
import assert from 'node:assert/strict';

import { runBackup, lastBackup, isDue, BACKUP_PREFIX, META_COLLECTION } from '../services/db/backup.js';
import { targetOf, getSecondaryUri, maskUri } from '../services/db/secondary.js';

/** MongoDB sürücüsünün kullandığımız kadarını taklit eden bellek içi veritabanı. */
function fakeDb(initial = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, v.map((d) => ({ ...d }))]));
  let failInsertOn = null;
  const cursor = (docs) => {
    let arr = [...docs];
    const c = {
      sort(spec) { const [[k, dir]] = Object.entries(spec); arr.sort((a, b) => (a[k] > b[k] ? dir : -dir)); return c; },
      skip(n) { arr = arr.slice(n); return c; },
      project() { return c; },
      async toArray() { return arr; },
      async *[Symbol.asyncIterator]() { for (const d of arr) yield d; },
    };
    return c;
  };
  const coll = (name) => ({
    find: () => cursor(data.get(name) || []),
    async insertMany(docs) {
      if (failInsertOn === name) throw new Error('yazma hatasi');
      data.set(name, [...(data.get(name) || []), ...docs.map((d) => ({ ...d }))]);
    },
    async insertOne(doc) { data.set(name, [...(data.get(name) || []), { _id: `${name}-${(data.get(name) || []).length}-${Math.random()}`, ...doc }]); },
    async drop() { data.delete(name); return true; },
    async rename(target, { dropTarget } = {}) {
      if (data.has(target) && !dropTarget) throw new Error('hedef var');
      data.set(target, data.get(name)); data.delete(name);
    },
    async deleteMany({ _id: { $in } }) { data.set(name, (data.get(name) || []).filter((d) => !$in.includes(d._id))); },
    async findOne(filter, { sort } = {}) {
      let arr = (data.get(name) || []).filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
      if (sort) { const [[k, dir]] = Object.entries(sort); arr = arr.sort((a, b) => (a[k] > b[k] ? dir : -dir)); }
      return arr[0] || null;
    },
  });
  return {
    data,
    failOn(name) { failInsertOn = name; },
    collection: coll,
    listCollections: ({ name }) => ({ toArray: async () => (data.has(name) ? [{ name }] : []) }),
  };
}

const primaryWith = () => fakeDb({
  searchhistories: [{ _id: 1, userId: 'u1', mainTopic: 'a' }, { _id: 2, userId: 'u2', mainTopic: 'b' }],
  collections: [{ _id: 3, userId: 'u1', name: 'Favoriler', papers: [] }],
  baskets: [{ _id: 4, userId: 'u1', papers: [{ title: 'x' }] }],
  searchcaches: [{ _id: 9, big: 'x'.repeat(1000) }],
});

test('kullanici verileri yedekleniyor, onbellekler yedeklenmiyor', async () => {
  const primary = primaryWith();
  const secondary = fakeDb();
  const meta = await runBackup({ primaryDb: primary, secondaryDb: secondary });
  assert.equal(meta.status, 'ok');
  assert.equal(secondary.data.get(`${BACKUP_PREFIX}searchhistories`).length, 2);
  assert.equal(secondary.data.get(`${BACKUP_PREFIX}baskets`).length, 1);
  assert.equal(secondary.data.has(`${BACKUP_PREFIX}searchcaches`), false);
  assert.equal(meta.collections.analyses.missing, true);
  // gecici koleksiyon kalmadi
  assert.equal([...secondary.data.keys()].some((k) => k.endsWith('__new')), false);
  assert.equal(secondary.data.get(META_COLLECTION).length, 1);
});

test('yeni yedek eskisinin yerini aliyor (yalnizca son yedek)', async () => {
  const primary = primaryWith();
  const secondary = fakeDb();
  await runBackup({ primaryDb: primary, secondaryDb: secondary });
  primary.data.get('searchhistories').push({ _id: 5, userId: 'u3' });
  await runBackup({ primaryDb: primary, secondaryDb: secondary });
  assert.equal(secondary.data.get(`${BACKUP_PREFIX}searchhistories`).length, 3);
});

test('yarida kalan yedek onceki saglam yedegi bozmuyor', async () => {
  const primary = primaryWith();
  const secondary = fakeDb();
  await runBackup({ primaryDb: primary, secondaryDb: secondary });
  primary.data.get('searchhistories').push({ _id: 6 });
  secondary.failOn(`${BACKUP_PREFIX}baskets__new`);
  const meta = await runBackup({ primaryDb: primary, secondaryDb: secondary });
  assert.equal(meta.status, 'failed');
  // gecmis yedegi hala ilk (2 kayit); yari yazilmis 3 kayitlik surum degil
  assert.equal(secondary.data.get(`${BACKUP_PREFIX}searchhistories`).length, 2);
  assert.equal([...secondary.data.keys()].some((k) => k.endsWith('__new')), false);
});

test('boyut siniri asilirsa yedek alinmiyor ve bildiriliyor', async () => {
  const secondary = fakeDb();
  const meta = await runBackup({ primaryDb: primaryWith(), secondaryDb: secondary, maxBytes: 50 });
  assert.equal(meta.status, 'failed');
  assert.match(meta.error, /boyutu/);
  assert.equal(secondary.data.has(`${BACKUP_PREFIX}searchhistories`), false);
});

test('zamanlama: son basarili yedek 20 saatten eskiyse sira gelmis', async () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  assert.equal(isDue(null, now), true);
  assert.equal(isDue({ at: new Date(now - 3 * 3600e3) }, now), false);
  assert.equal(isDue({ at: new Date(now - 21 * 3600e3) }, now), true);
  const secondary = fakeDb();
  await runBackup({ primaryDb: primaryWith(), secondaryDb: secondary });
  assert.equal((await lastBackup(secondary, { onlyOk: true })).status, 'ok');
});

test('ikinci DB ana DB ile ayni yeri gosteremez; sifre loglanmaz', () => {
  assert.equal(targetOf('mongodb+srv://u:p@c1.abc.mongodb.net/literature-ai?x=1'), 'c1.abc.mongodb.net/literature-ai');
  assert.notEqual(targetOf('mongodb+srv://u:p@c1.abc.mongodb.net/a'), targetOf('mongodb+srv://u:p@c2.def.mongodb.net/a'));
  assert.equal(getSecondaryUri({ MONGODB_BACKUP_URI: ' mongodb://x ' }), 'mongodb://x');
  assert.equal(getSecondaryUri({}), null);
  assert.equal(maskUri('baglanamadi mongodb+srv://user:secret@host/db oldu'), 'baglanamadi mongodb://<gizli> oldu');
});
