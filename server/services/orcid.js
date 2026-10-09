import { fetchWithTimeout } from '../utils/http.js';

/**
 * ORCID: yazar panelinde yalnızca ZENGİNLEŞTİRME (CLAUDE.md 2.11, 3.10).
 *
 * Aday listesini yalnızca OpenAlex üretir. ORCID, listede zaten olan ve
 * ORCID'i bilinen kişilerin kurum geçmişini getirir; liste bunu beklemez,
 * başarısız olursa kart rozetsiz kalır. ORCID'den kişi eklenmez, yayın
 * listesi çekilmez (yazarlık orada beyana dayalı).
 *
 * Lisans (2.7): Public API gelir getiren ürünle kullanılamaz. Ürün gelir
 * üretmeye başladığı gün ORCID_ENABLED kapatılır.
 * Limit: 12 istek/sn (40 burst, aşılırsa 503); kayıtsız 25.000 okuma/gün/IP.
 */

const ORCID_SEARCH_URL = 'https://pub.orcid.org/v3.0/expanded-search/';
// Bir aday listesi en fazla bu kadar kişi; tek istekte sorulur.
export const MAX_ENRICH_IDS = 10;

export const isOrcidEnabled = (env = process.env) => env.ORCID_ENABLED === 'true';

/**
 * Kullanıcının yazdığı metin bir ORCID iD mi? "0000-0002-1594-3680",
 * "https://orcid.org/0000-0002-1594-3680" veya tiresiz 16 hane kabul edilir;
 * ISO 7064 11,2 sağlama hanesi tutmazsa null (yazım hatası ORCID sayılmaz).
 */
export function parseOrcidId(input) {
  const raw = String(input ?? '').trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{15}[\dX]$/.test(raw)) return null;
  let total = 0;
  for (const d of raw.slice(0, 15)) total = (total + Number(d)) * 2;
  const result = (12 - (total % 11)) % 11;
  if (raw[15] !== (result === 10 ? 'X' : String(result))) return null;
  return raw.match(/.{4}/g).join('-');
}

const TR_FOLD = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' };

/** Tekrarı ayıklama anahtarı. Bazı kayıtlarda "Mi̇lli̇" gibi i + birleşik nokta var. */
function dedupeKey(s) {
  return String(s ?? '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_FOLD[c])
    .normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
}

/** Geçerli iD'leri tekilleştirip sorguya çevirir: orcid:(a OR b). */
export function buildAffiliationQuery(orcids) {
  const ids = [...new Set((orcids || []).map(parseOrcidId).filter(Boolean))].slice(0, MAX_ENRICH_IDS);
  return ids.length > 0 ? { ids, q: `orcid:(${ids.join(' OR ')})` } : null;
}

/** expanded-search yanıtı -> { "0000-…": ["Hacettepe University", …] } */
export function parseAffiliations(data) {
  const out = {};
  for (const p of data?.['expanded-result'] || []) {
    const id = parseOrcidId(p['orcid-id']);
    if (!id) continue;
    const seen = new Set();
    out[id] = (p['institution-name'] || []).filter((n) => {
      const key = dedupeKey(n);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }
  return out;
}

/**
 * Listede olan kişilerin ORCID kurum geçmişi, tek istekte. ORCID'de kaydı
 * olmayan iD sonuçta yer almaz.
 */
export async function fetchOrcidAffiliations(orcids, { env = process.env, timeoutMs = 4000 } = {}) {
  const built = buildAffiliationQuery(orcids);
  if (!built) return {};

  const url = `${ORCID_SEARCH_URL}?${new URLSearchParams({ q: built.q, rows: String(built.ids.length) }).toString()}`;
  const headers = { Accept: 'application/json' };
  // Anahtarsız da çalışıyor; /read-public token'ı günlük kotayı 100.000'e çıkarır.
  const token = env.ORCID_ACCESS_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs);
  if (!response.ok) throw new Error(`ORCID API Hatası (${response.status})`);
  return parseAffiliations(await response.json());
}
