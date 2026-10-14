/**
 * Çoklu taslak deposu (WO-011 Faz 1). Saf: depolama dışarıdan verilir
 * (tarayıcıda `localStorage`, testte bellek içi taklit).
 *
 * Yapı:
 *   literatur-ai:drafts:v1      → { activeId, items: [{ id, title, savedAt, words, section, format }] }
 *   literatur-ai:draft:<id>     → Workspace'in kaydettiği belge (html, setup, view, …)
 *
 * Eski tek belge (`literatur-ai:workspace:v2`) ilk okumada bir taslağa
 * kopyalanır; eski anahtar SİLİNMEZ — taşıma ters giderse veri yerinde.
 *
 * Her şey bu tarayıcıda durur; sunucu kaydı yok. Arayüz bunu söyler.
 */

export const INDEX_KEY = 'literatur-ai:drafts:v1';
export const DRAFT_PREFIX = 'literatur-ai:draft:';
export const LEGACY_KEY = 'literatur-ai:workspace:v2';

const draftKey = (id) => `${DRAFT_PREFIX}${id}`;

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

export function newId(now = Date.now(), random = Math.random) {
  return `d${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`;
}

/** HTML'den kelime sayısı — DOM'suz, özet için yeterli. */
export function wordsOf(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

const emptyIndex = () => ({ activeId: null, items: [] });

/**
 * Dizini okur; yoksa ve eski tek belge varsa onu taşır.
 * @returns {{activeId: string|null, items: object[], migrated?: boolean}}
 */
export function loadIndex(storage, { now = Date.now(), random = Math.random } = {}) {
  const index = readJson(storage, INDEX_KEY);
  if (index && Array.isArray(index.items)) return index;
  const legacy = readJson(storage, LEGACY_KEY);
  if (!legacy?.html && !legacy?.title) return emptyIndex();
  const id = newId(now, random);
  writeJson(storage, draftKey(id), legacy);
  const migrated = {
    activeId: id,
    items: [{
      id,
      title: legacy.title || '',
      savedAt: legacy.savedAt || now,
      words: wordsOf(legacy.html),
      section: legacy.lastSection?.text || '',
      format: legacy.format || null,
    }],
  };
  writeJson(storage, INDEX_KEY, migrated);
  return { ...migrated, migrated: true };
}

export function readDraft(storage, id) {
  return id ? readJson(storage, draftKey(id)) : null;
}

/**
 * Belgeyi ve dizindeki özetini yazar. Depolama doluysa ya da kapalıysa
 * hata fırlatır — çağıran "Kaydedilemedi" der, sessizce yutmaz.
 */
export function writeDraft(storage, id, data, { now = Date.now() } = {}) {
  writeJson(storage, draftKey(id), data);
  const index = loadIndex(storage);
  const meta = {
    id,
    title: data.title || '',
    savedAt: data.savedAt || now,
    words: Number.isFinite(data.words) ? data.words : wordsOf(data.html),
    section: data.lastSection?.text || '',
    format: data.format || null,
  };
  const exists = index.items.some((d) => d.id === id);
  const items = exists ? index.items.map((d) => (d.id === id ? meta : d)) : [meta, ...index.items];
  writeJson(storage, INDEX_KEY, { activeId: index.activeId || id, items });
  return meta;
}

/** Yeni taslak: başlangıç içeriğiyle yazılır ve etkin olur. */
export function createDraft(storage, data = {}, { now = Date.now(), random = Math.random } = {}) {
  const id = newId(now, random);
  writeDraft(storage, id, { ...data, savedAt: now }, { now });
  setActive(storage, id);
  return id;
}

export function setActive(storage, id) {
  const index = loadIndex(storage);
  if (id !== null && !index.items.some((d) => d.id === id)) return index;
  const next = { ...index, activeId: id };
  writeJson(storage, INDEX_KEY, next);
  return next;
}

export function renameDraft(storage, id, title) {
  const data = readDraft(storage, id);
  if (!data) return null;
  // Sürüm artar: açık belge yeni adı görür, eski adla üzerine yazmaz.
  return writeDraft(storage, id, { ...data, title: String(title || '').trim(), rev: (data.rev || 0) + 1 });
}

/** Kopya: aynı içerik, "(kopya)" ekli başlık; etkin olmaz. */
export function duplicateDraft(storage, id, { now = Date.now(), random = Math.random, suffix = ' (kopya)' } = {}) {
  const data = readDraft(storage, id);
  if (!data) return null;
  const copyId = newId(now, random);
  writeDraft(storage, copyId, { ...data, title: `${data.title || ''}${suffix}`.trim(), savedAt: now }, { now });
  return copyId;
}

/**
 * Siler ve geri alma için anlık görüntü döndürür. Etkin taslak silinirse
 * sıradaki etkin olur (yoksa null).
 */
export function deleteDraft(storage, id) {
  const index = loadIndex(storage);
  const position = index.items.findIndex((d) => d.id === id);
  if (position < 0) return null;
  const snapshot = { id, data: readDraft(storage, id), meta: index.items[position], position };
  storage.removeItem(draftKey(id));
  storage.removeItem(lockKey(id));
  const items = index.items.filter((d) => d.id !== id);
  const activeId = index.activeId === id ? (items[0]?.id || null) : index.activeId;
  writeJson(storage, INDEX_KEY, { activeId, items });
  return snapshot;
}

// --- Sekmeler arası tutarlılık (WO-011 Faz 1 ek) ---------------------------
// Aynı taslak iki sekmede açıkken her sekme belgenin tamamını kendi
// belleğinden yazıyordu; son yazan öbürünü sessizce eziyordu. İki önlem:
//   1. Sürüm: her kayıt `rev` taşır. Kaydeden sekme, yüklediği sürümden
//      yenisi depoya yazılmışsa üzerine yazmaz (saveDraft → conflict).
//   2. Kilit: taslağı düzenleyen sekme kilidi tutar ve tazeler; öbür
//      sekmeler salt okunur açılır, "Burada düzenle" ile kilidi alabilir.

const LOCK_PREFIX = 'literatur-ai:draft-lock:';
export const lockKey = (id) => `${LOCK_PREFIX}${id}`;
/** Kilit bu kadar süre tazelenmezse sahibi kapanmış sayılır. */
export const LOCK_TTL = 12000;
/** Sahip sekme kilidi bu aralıkla tazeler. */
export const LOCK_BEAT = 4000;

export function readLock(storage, id) {
  return readJson(storage, lockKey(id));
}

export function writeLock(storage, id, tab, now = Date.now()) {
  writeJson(storage, lockKey(id), { tab, at: now });
}

/** Kilit yalnız sahibi tarafından bırakılır. */
export function releaseLock(storage, id, tab) {
  if (readLock(storage, id)?.tab === tab) storage.removeItem(lockKey(id));
}

/** @returns {'none'|'self'|'other'} */
export function lockHolder(lock, tab, now = Date.now()) {
  if (!lock?.tab || now - (lock.at || 0) >= LOCK_TTL) return 'none';
  return lock.tab === tab ? 'self' : 'other';
}

/**
 * Sürüm denetimli kayıt. Depodaki sürüm, sekmenin yüklediği sürümle aynıysa
 * yazar ve yeni sürümü döndürür; başka bir sekme araya yazdıysa yazmaz.
 * Taslak başka sekmede silindiyse yazar (metin kaybolmasın).
 * @returns {{rev: number, meta: object} | {conflict: true, stored: object}}
 */
export function saveDraft(storage, id, data, { baseRev = 0, now = Date.now() } = {}) {
  const stored = readDraft(storage, id);
  const storedRev = stored?.rev || 0;
  if (stored && storedRev !== baseRev) return { conflict: true, stored };
  const rev = Math.max(storedRev, baseRev) + 1;
  const meta = writeDraft(storage, id, { ...data, rev }, { now });
  return { rev, meta };
}

/** Çakışmada bu sekmenin metni ayrı taslak olur; etkin taslak değişmez. */
export function saveConflictCopy(storage, id, data, { now = Date.now(), random = Math.random, suffix = ' (çakışma kopyası)' } = {}) {
  const copyId = newId(now, random);
  writeDraft(storage, copyId, { ...data, title: `${data.title || ''}${suffix}`.trim(), savedAt: now, rev: 1 }, { now });
  return copyId;
}

/** Silinen taslağı aynı yerine geri koyar. */
export function restoreDraft(storage, snapshot) {
  if (!snapshot?.id || !snapshot.data) return null;
  writeJson(storage, draftKey(snapshot.id), snapshot.data);
  const index = loadIndex(storage);
  const items = index.items.filter((d) => d.id !== snapshot.id);
  items.splice(Math.min(snapshot.position, items.length), 0, snapshot.meta);
  writeJson(storage, INDEX_KEY, { activeId: index.activeId || snapshot.id, items });
  return snapshot.id;
}
