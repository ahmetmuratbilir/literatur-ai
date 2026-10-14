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
  return writeDraft(storage, id, { ...data, title: String(title || '').trim() });
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
  const items = index.items.filter((d) => d.id !== id);
  const activeId = index.activeId === id ? (items[0]?.id || null) : index.activeId;
  writeJson(storage, INDEX_KEY, { activeId, items });
  return snapshot;
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
