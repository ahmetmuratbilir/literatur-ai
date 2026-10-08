/**
 * Havuzdan siralama: AHP + ceviri, istek aninda.
 *
 * NEDEN: Arama onbellegi (getSharedSearchCache) KULLANICILAR ARASINDA
 * paylasiliyor ve eskiden AHP siralamasi sonuca gomulu kaydediliyordu.
 * Agirliklar kullaniciya ozel olunca A kullanicisinin "en cok atif alanlar"
 * siralamasi, "guncel arastirmalar" secmis B kullanicisina servis edilirdi.
 *
 * Cozum: onbellege AHP ONCESI havuz yazilir, siralama her istekte uygulanir.
 * AHP saf CPU isi; 25 makale icin olculebilir maliyeti yok. Agirliklari
 * onbellek anahtarina eklemek ise isabet oranini cokertirdi.
 *
 * Ceviri pahali (LLM cagrisi), o yuzden ceviriler makale anahtariyla ayri
 * saklanir ve yalnizca EKSIK olanlar cevrilir. Yalnizca basliklar cevrilir
 * (kullanici karari); havuz <= 25 makale oldugu icin agirlik degisince yeni
 * ceviri gerekmez.
 */
import { calculateAHP } from './ahp.js';
import { batchTranslateAcademic } from '../utils/translation.js';
import { annotateRetractions, normalizeDoi } from './retraction.js';

/** Makale icin kararli anahtar: DOI > kaynak kimligi > baslik. */
export function itemKey(item) {
  const doi = String(item?.doi || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  if (doi.length > 5) return `doi:${doi}`;
  if (item?.id) return `id:${item.id}`;
  return `t:${String(item?.title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200)}`;
}

/** Sonuclardaki cevirileri anahtar -> {titleTR, teaserTR} haritasina toplar. */
export function extractTranslations(results, into = {}) {
  for (const r of results || []) {
    if (!r?.titleTR && !r?.teaserTR) continue;
    const key = itemKey(r);
    into[key] = {
      ...(into[key] || {}),
      ...(r.titleTR ? { titleTR: r.titleTR } : {}),
      ...(r.teaserTR ? { teaserTR: r.teaserTR } : {}),
    };
  }
  return into;
}

function applyTranslations(results, translations) {
  // Yalnizca baslik: ozet cevirisi urunden kaldirildi. Eski kayitlarda
  // teaserTR olsa bile uygulanmaz.
  for (const r of results) {
    const t = translations?.[itemKey(r)];
    if (t?.titleTR && !r.titleTR) r.titleTR = t.titleTR;
  }
}

/** Basligi cevrilmemis makaleler. */
export function findMissingTranslations(ranked) {
  return ranked.filter((r) => !r.titleTR);
}

/**
 * @param {Array} pool  AHP oncesi, zenginlestirilmis havuz (degistirilmez)
 * @param {{weights?: object|null, displayCount?: number, translations?: object, translate?: Function}} options
 * @returns {Promise<{results: Array, translations: object, translatedCount: number}>}
 */
export async function rankFromPool(pool, options = {}) {
  const {
    weights = null,
    displayCount = 25,
    translations = {},
    translate = batchTranslateAcademic,
    // Ceviri ISTEGE BAGLI, varsayilan KAPALI (kullanici karari). Kapaliyken
    // onbellekte ceviri olsa bile uygulanmaz: kullanici Ingilizce istedi.
    translateEnabled = false,
    // Yazar aramasi: konu suzmesini OpenAlex yapti, alaka esigi tekrar uygulanmaz.
    skipRelevanceGate = false,
  } = options;

  // calculateAHP her makale icin YENI nesne donduruyor (...item); havuz
  // nesneleri degismez, boylece ayni havuz farkli agirliklarla tekrar
  // siralanabilir.
  const ranked = (await calculateAHP(pool || [], weights, { skipRelevanceGate })).slice(0, displayCount);
  if (!translateEnabled) {
    return { results: ranked, translations: { ...translations }, translatedCount: 0 };
  }
  applyTranslations(ranked, translations);

  const missing = findMissingTranslations(ranked);
  let translatedCount = 0;
  if (missing.length > 0) {
    try {
      // batchTranslateAcademic dizideki nesneleri yerinde gunceller.
      await translate(missing);
      translatedCount = missing.filter((m) => m.titleTR || m.teaserTR).length;
    } catch (error) {
      // Ceviri basarisizligi siralamayi dusurmemeli; Ingilizce gosterilir.
      console.warn('[Ranking] Eksik ceviriler tamamlanamadi:', error?.message || error);
    }
  }

  const merged = extractTranslations(ranked, { ...translations });
  return { results: ranked, translations: merged, translatedCount };
}

/** Istemcinin ilk gosterdigi sayfa; "Daha fazla goster" 25'er acar. */
export const FIRST_PAGE_SIZE = 25;

/**
 * Siralar, sonra YALNIZCA ilk sayfanin geri cekilme durumunu kontrol eder.
 *
 * NEDEN: Crossref kontrolu 20 DOI'lik paketlerle sirayla calisiyor. Olculdu
 * (1 Eki 2026): 25 DOI 3,6 sn, 100 DOI 11 sn. Tum adaylari aramada kontrol
 * etmek aramayi ~7 sn uzatirdi; sonraki sayfalar /api/retractions ile acildikca
 * kontrol edilir.
 *
 * Ilk sayfada geri cekilmis ya da endise bildirimli makale cikarsa havuz
 * yeniden siralanir: AHP bu makalenin puanini dusurur ve ust siradan iner.
 * Durum havuz nesnelerine yazilir, boylece onbellege de gecer.
 */
export async function rankWithFirstPageRetractions(pool, options = {}, { annotate = annotateRetractions, pageSize = FIRST_PAGE_SIZE } = {}) {
  let ranked = await rankFromPool(pool, options);
  const firstPage = ranked.results.slice(0, pageSize).filter((r) => r?.doi && !r.retraction);
  const summary = { retracted: 0, concern: 0, checked: 0, errors: [] };
  if (firstPage.length === 0) return { ...ranked, retractionSummary: summary };

  const result = await annotate(firstPage);
  Object.assign(summary, result);

  // Siralanan kopyalardaki durumu havuz nesnelerine tasi (DOI ile)
  const byDoi = new Map(firstPage.map((r) => [normalizeDoi(r.doi), r.retraction]));
  for (const item of pool || []) {
    const status = item?.doi && byDoi.get(normalizeDoi(item.doi));
    if (status && !item.retraction) item.retraction = status;
  }

  const flagged = firstPage.some((r) => r.retraction?.status === 'retracted' || r.retraction?.status === 'concern');
  if (flagged) ranked = await rankFromPool(pool, options);
  return { ...ranked, retractionSummary: summary };
}
