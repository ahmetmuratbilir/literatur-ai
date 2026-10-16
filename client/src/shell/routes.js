/**
 * Uygulama kabuğunun adresleri (WO-010).
 *
 * Hash kullanılıyor: sunucu tarafında yönlendirme yok, yeni bağımlılık yok,
 * geri tuşu ve sayfa yenileme kullanıcıyı aynı modülde bırakıyor. Paylaşım
 * bağlantısı (`?s=`) arama dizgesinde, bu adreslerle çakışmıyor.
 *
 * Saf modül: DOM'a dokunmaz, test edilebilir.
 */

/** Raydaki modüller, sıralı. Yalnız çalışan modüller burada (WO-010 K4). */
export const MODULES = ['home', 'write', 'sources', 'audit'];

/** Kaynaklar modülünün alt sayfaları. */
export const SOURCE_TABS = ['search', 'author', 'basket', 'favorites'];

const SEGMENT = {
  home: 'alanim',
  write: 'yazim',
  sources: 'kaynaklar',
  audit: 'denetim',
};

const SOURCE_SEGMENT = {
  search: 'ara',
  author: 'arastirmaci',
  basket: 'sepet',
  favorites: 'favoriler',
};

const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
const MODULE_BY_SEGMENT = invert(SEGMENT);
const SOURCE_BY_SEGMENT = invert(SOURCE_SEGMENT);

/** Kullanıcı ilk açtığında: arama, bugünkü giriş kapısı. */
export const DEFAULT_ROUTE = Object.freeze({ module: 'sources', tab: 'search' });

/**
 * `#/kaynaklar/ara` → `{ module: 'sources', tab: 'search' }`.
 * Tanınmayan adres varsayılana düşer; boş ekran gösterilmez.
 */
export function parseHash(hash) {
  const parts = String(hash || '')
    .replace(/^#\/?/, '')
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p).toLowerCase());
  const module = MODULE_BY_SEGMENT[parts[0]];
  if (!module) return { ...DEFAULT_ROUTE };
  if (module === 'sources') {
    return { module, tab: SOURCE_BY_SEGMENT[parts[1]] || 'search' };
  }
  return { module, tab: null };
}

/** `{ module: 'sources', tab: 'basket' }` → `#/kaynaklar/sepet`. */
export function formatRoute(route) {
  const module = MODULES.includes(route?.module) ? route.module : DEFAULT_ROUTE.module;
  const head = `#/${SEGMENT[module]}`;
  if (module !== 'sources') return head;
  const tab = SOURCE_TABS.includes(route?.tab) ? route.tab : 'search';
  return `${head}/${SOURCE_SEGMENT[tab]}`;
}

export const sameRoute = (a, b) => a?.module === b?.module && (a?.tab || null) === (b?.tab || null);

/**
 * Eski arayüzün `mode` değeri ↔ kabuk adresi. Durum `App.jsx`'te kaldığı
 * için (WO-010: bu iş emrinde durum refaktörü yok) iki dünya bu tabloyla
 * konuşuyor.
 */
export function modeForRoute(route) {
  if (route?.module === 'write') return 'workspace';
  if (route?.module === 'sources' && route.tab === 'author') return 'author';
  return 'search';
}

export function routeForMode(mode) {
  if (mode === 'workspace') return { module: 'write', tab: null };
  if (mode === 'author') return { module: 'sources', tab: 'author' };
  return { module: 'sources', tab: 'search' };
}

/**
 * Açık çalışma sekmeleri (WO-010 K8): ilk sürümde modül oturumları.
 * Adres hangi oturuma ait?
 */
export function sessionForRoute(route) {
  if (route?.module === 'write') return 'draft';
  if (route?.module === 'audit') return 'audit';
  if (route?.module === 'sources' && route.tab === 'search') return 'search';
  if (route?.module === 'sources' && route.tab === 'author') return 'author';
  return null;
}

export function routeForSession(session) {
  if (session === 'draft') return { module: 'write', tab: null };
  if (session === 'audit') return { module: 'audit', tab: null };
  if (session === 'author') return { module: 'sources', tab: 'author' };
  return { module: 'sources', tab: 'search' };
}

/**
 * Sekme kapatılınca nereye gidilir: soldaki komşu, yoksa sağdaki, yoksa Alanım.
 * @returns {{ tabs: string[], next: object|null }} `next` yalnız kapatılan
 *   sekme etkinken dolu
 */
export function closeSession(tabs, session, activeSession) {
  const index = tabs.indexOf(session);
  if (index < 0) return { tabs, next: null };
  const rest = tabs.filter((s) => s !== session);
  if (session !== activeSession) return { tabs: rest, next: null };
  const neighbour = rest[index - 1] || rest[index] || null;
  return { tabs: rest, next: neighbour ? routeForSession(neighbour) : { module: 'home', tab: null } };
}

/** Oturumu sekme listesine ekler (zaten varsa sırası değişmez). */
export const openSession = (tabs, session) => (session && !tabs.includes(session) ? [...tabs, session] : tabs);
