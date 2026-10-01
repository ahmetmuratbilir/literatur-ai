/**
 * Gece yedeği: ana MongoDB'deki KULLANICI verileri → ikinci MongoDB.
 *
 * Yedeklenen: arama geçmişi, favoriler (collections), makale listesi
 * (baskets), analizler, paylaşımlar. Yedeklenmeyen: önbellekler
 * (searchcaches, writercaches, resolvercaches) ve embedding'ler; yeniden
 * üretilebilirler ve alanın çoğunu kaplarlar.
 *
 * Yöntem: her koleksiyon önce `backup_<ad>__new` geçici koleksiyonuna yazılır,
 * bitince `backup_<ad>` ile yer değiştirir (rename + dropTarget). Yarıda kalan
 * bir yedek önceki sağlam yedeği bozmaz. Yalnızca son yedek tutulur (alan
 * 512 MB); her çalışma `backup_meta`ya kaydedilir.
 */

export const BACKUP_COLLECTIONS = ['searchhistories', 'collections', 'baskets', 'analyses', 'sharedsearches'];
export const BACKUP_PREFIX = 'backup_';
export const META_COLLECTION = 'backup_meta';
export const MIN_INTERVAL_MS = 20 * 3600 * 1000; // "gece" yedeği: en sık 20 saatte bir
// Kullanıcı verisi kullanıcı başı ~85 KB; 150 MB ~1.800 kullanıcı eder. Aşılırsa
// yedek ALINMAZ ve bildirilir: ikinci DB'nin DergiPark dizinine yer kalmalı.
export const MAX_BACKUP_BYTES = 150 * 1024 * 1024;
const BATCH = 500;
const META_KEEP = 30;

const approxBytes = (doc) => Buffer.byteLength(JSON.stringify(doc));

async function collectionExists(db, name) {
  const found = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return found.length > 0;
}

/** Tek koleksiyonu geçici hedefe kopyalar; {count, bytes}. Boyut aşılırsa fırlatır. */
async function copyCollection(primaryDb, secondaryDb, name, budget) {
  const tmpName = `${BACKUP_PREFIX}${name}__new`;
  if (await collectionExists(secondaryDb, tmpName)) await secondaryDb.collection(tmpName).drop();
  const tmp = secondaryDb.collection(tmpName);
  let count = 0;
  let bytes = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    await tmp.insertMany(batch, { ordered: false });
    batch = [];
  };
  for await (const doc of primaryDb.collection(name).find({})) {
    bytes += approxBytes(doc);
    budget.used += approxBytes(doc);
    if (budget.used > budget.max) {
      await flush();
      await tmp.drop().catch(() => {});
      throw new Error(`Yedek boyutu sınırı aşıldı (${Math.round(budget.max / 1048576)} MB)`);
    }
    batch.push(doc);
    count++;
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return { tmpName, count, bytes };
}

/**
 * Yedeği çalıştırır. Önce TÜM koleksiyonlar geçici hedeflere yazılır, ancak
 * hepsi başarılıysa yer değiştirilir: yedek ya bütün ya hiç.
 */
export async function runBackup({ primaryDb, secondaryDb, collections = BACKUP_COLLECTIONS, maxBytes = MAX_BACKUP_BYTES, now = () => Date.now(), trigger = 'auto' }) {
  if (!primaryDb || !secondaryDb) throw new Error('Veritabanı bağlantısı yok');
  const started = now();
  const budget = { used: 0, max: maxBytes };
  const copied = [];
  const meta = { at: new Date(started), trigger, status: 'ok', collections: {}, bytes: 0, durationMs: 0, error: null };
  try {
    for (const name of collections) {
      if (!(await collectionExists(primaryDb, name))) {
        meta.collections[name] = { count: 0, bytes: 0, missing: true };
        continue;
      }
      const result = await copyCollection(primaryDb, secondaryDb, name, budget);
      copied.push({ name, ...result });
      meta.collections[name] = { count: result.count, bytes: result.bytes };
    }
    for (const c of copied) {
      const target = `${BACKUP_PREFIX}${c.name}`;
      if (c.count === 0) {
        // Boş kaynak: geçici koleksiyon hiç oluşmamış olabilir; hedef de boşalır.
        if (await collectionExists(secondaryDb, c.tmpName)) await secondaryDb.collection(c.tmpName).drop();
        if (await collectionExists(secondaryDb, target)) await secondaryDb.collection(target).drop();
        continue;
      }
      await secondaryDb.collection(c.tmpName).rename(target, { dropTarget: true });
    }
    meta.bytes = budget.used;
  } catch (error) {
    meta.status = 'failed';
    meta.error = String(error?.message || error).slice(0, 300);
    for (const c of copied) await secondaryDb.collection(c.tmpName).drop().catch(() => {});
  }
  meta.durationMs = now() - started;
  await secondaryDb.collection(META_COLLECTION).insertOne(meta);
  const old = await secondaryDb.collection(META_COLLECTION).find({}).sort({ at: -1 }).skip(META_KEEP).project({ _id: 1 }).toArray();
  if (old.length) await secondaryDb.collection(META_COLLECTION).deleteMany({ _id: { $in: old.map((d) => d._id) } });
  return meta;
}

export async function lastBackup(secondaryDb, { onlyOk = false } = {}) {
  if (!secondaryDb) return null;
  return secondaryDb.collection(META_COLLECTION).findOne(onlyOk ? { status: 'ok' } : {}, { sort: { at: -1 } });
}

export function isDue(last, now = Date.now(), minIntervalMs = MIN_INTERVAL_MS) {
  if (!last?.at) return true;
  return now - new Date(last.at).getTime() >= minIntervalMs;
}

/**
 * Zamanlayıcı. Render'ın ücretsiz sunucusu boştayken uyuduğu için saat ayarlı
 * cron güvenilmez: açılışta ve her `checkEveryMs`'de "son başarılı yedek 20
 * saatten eski mi?" diye bakılır.
 */
export function startBackupScheduler({ getPrimaryDb, getSecondaryDb, checkEveryMs = 6 * 3600 * 1000, firstCheckMs = 2 * 60 * 1000, log = console }) {
  let running = false;
  const tick = async () => {
    if (running) return;
    const primaryDb = getPrimaryDb();
    const secondaryDb = getSecondaryDb();
    if (!primaryDb || !secondaryDb) return;
    running = true;
    try {
      const last = await lastBackup(secondaryDb, { onlyOk: true });
      if (!isDue(last)) return;
      const meta = await runBackup({ primaryDb, secondaryDb, trigger: 'auto' });
      log.log(`[Yedek] ${meta.status} — ${Object.entries(meta.collections).map(([k, v]) => `${k}:${v.count}`).join(' ')} — ${(meta.bytes / 1048576).toFixed(2)} MB, ${meta.durationMs} ms${meta.error ? ` — ${meta.error}` : ''}`);
    } catch (error) {
      log.error('[Yedek] Çalıştırılamadı:', String(error?.message || error).slice(0, 200));
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, firstCheckMs);
  const every = setInterval(tick, checkEveryMs);
  first.unref?.();
  every.unref?.();
  return { tick, stop: () => { clearTimeout(first); clearInterval(every); }, isRunning: () => running };
}
