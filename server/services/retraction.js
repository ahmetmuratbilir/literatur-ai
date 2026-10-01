/**
 * Geri cekilmis makale kontrolu (Crossref + Retraction Watch).
 *
 * Crossref, Retraction Watch veritabanini REST API'ye katti; bir makaleye ait
 * duzeltme ve geri cekme bildirimleri kaydin `updated-by` alaninda geliyor.
 *
 * Olculen (30 Eyl 2026):
 *
 *   Wakefield 1998 (10.1016/S0140-6736(97)11096-0)
 *     updated-by  correction   retraction-watch   (2004)
 *     updated-by  retraction   retraction-watch   (2010)
 *
 *   Mehra 2020 / Surgisphere (10.1016/S0140-6736(20)31180-6)
 *     updated-by  expression_of_concern, correction, retraction x2, erratum x3
 *     update-to   retraction x4   <- ORIJINAL kayitta, bildirimlere isaret ediyor
 *
 * IKI KURAL bu olcumlerden cikiyor:
 *
 *  1. Listenin ilk kaydina bakmak YANLIS. Wakefield'in ilk kaydi 2004 tarihli
 *     bir correction; geri cekme ikinci sirada. Tum liste taranmali.
 *
 *  2. Karar yalnizca `updated-by`'dan verilir, `update-to`'dan DEGIL.
 *     `update-to` normalde bildirimin kendisinde durur ve orijinali gosterir;
 *     ona bakmak geri cekme BILDIRIMINI "geri cekildi" diye isaretler. Mehra
 *     kaydi gosteriyor ki yayincilar bu alani tutarsiz dolduruyor.
 */
import { fetchWithTimeout } from '../utils/http.js';

/**
 * Makaleyi gecersiz kilan turler. `retraction` olcumde goruldu; `withdrawal`
 * ve `removal` Crossref'in guncelleme turleri arasinda belgelenmis ama bu
 * olcumde karsilasilmadi (dogrulanmali).
 */
const RETRACTED_TYPES = new Set(['retraction', 'withdrawal', 'removal']);

/**
 * Makaleyi gecersiz kilmayan ama okuru uyarmasi gereken turler.
 * `expression_of_concern` olcumde goruldu; `partial_retraction` dogrulanmali.
 */
const CONCERN_TYPES = new Set(['expression_of_concern', 'partial_retraction']);

/** Crossref'in toplu DOI filtresinde tek istekte sorulan DOI sayisi. */
const BATCH_SIZE = 20;

/** Arama yanitini bekleten bir kontrol; uzun surerse atlanir. */
const DEFAULT_TIMEOUT_MS = 4000;

export function normalizeDoi(value) {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:/, '');
}

function noticeDate(entry) {
  const parts = entry?.updated?.['date-parts']?.[0];
  if (Array.isArray(parts) && parts[0]) return parts.map((p) => String(p).padStart(2, '0')).join('-');
  return null;
}

/**
 * Tek bir Crossref kaydindan geri cekme durumunu cikarir. Saf fonksiyon.
 *
 * @returns {{status: 'retracted'|'concern'|'none', notices: Array<{type, doi, source, date}>}}
 */
export function parseRetraction(item) {
  const updatedBy = Array.isArray(item?.['updated-by']) ? item['updated-by'] : [];

  const notices = updatedBy
    .filter((e) => e && (RETRACTED_TYPES.has(e.type) || CONCERN_TYPES.has(e.type)))
    .map((e) => ({
      type: e.type,
      doi: e.DOI ? normalizeDoi(e.DOI) : null,
      source: e.source || null,
      date: noticeDate(e),
    }));

  let status = 'none';
  if (notices.some((n) => RETRACTED_TYPES.has(n.type))) status = 'retracted';
  else if (notices.some((n) => CONCERN_TYPES.has(n.type))) status = 'concern';

  return { status, notices };
}

/**
 * Verilen DOI'lerin geri cekme durumunu Crossref'ten toplu sorar.
 *
 * Hata durumunda BOS doner, firlatmaz: bu bir zenginlestirme adimi ve
 * Crossref'e ulasilamamasi aramayi dusurmemeli. Ama sessiz de kalmaz;
 * `errors` alaninda ne oldugu raporlanir.
 *
 * @param {string[]} dois
 * @param {{timeoutMs?: number, fetchImpl?: Function, mailto?: string}} [options]
 * @returns {Promise<{byDoi: Map<string, ReturnType<typeof parseRetraction>>, checked: number, errors: string[]}>}
 */
export async function checkRetractions(dois, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetchWithTimeout,
    mailto = process.env.CONTACT_EMAIL || process.env.OPENALEX_MAIL || '',
  } = options;

  const unique = [...new Set((dois || []).map(normalizeDoi).filter((d) => d.length > 5))];
  const byDoi = new Map();
  const errors = [];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams({
      filter: batch.map((d) => `doi:${d}`).join(','),
      rows: String(batch.length),
      select: 'DOI,updated-by',
    });
    if (mailto && !/example\.(com|org|net)$/i.test(mailto)) params.set('mailto', mailto);

    try {
      const response = await fetchImpl(
        `https://api.crossref.org/works?${params}`,
        { headers: { 'User-Agent': `LiteratureAI/1.0${mailto ? ` (mailto:${mailto})` : ''}` } },
        timeoutMs
      );
      if (!response.ok) {
        errors.push(`HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      for (const item of data?.message?.items || []) {
        byDoi.set(normalizeDoi(item.DOI), parseRetraction(item));
      }
    } catch (error) {
      errors.push(error?.name === 'AbortError' ? `zaman asimi >${timeoutMs}ms` : String(error?.message || error));
    }
  }

  return { byDoi, checked: unique.length, errors };
}

/**
 * Sonuc listesindeki makalelere `retraction` alanini yazar (yerinde).
 *
 * Crossref kaynakli kayitlar bu bilgiyi aramada zaten tasiyor
 * (crossref.js select listesi); onlar icin tekrar sorulmaz.
 *
 * @returns {Promise<{retracted: number, concern: number, checked: number, errors: string[]}>}
 */
export async function annotateRetractions(results, options = {}) {
  const pending = (results || []).filter((r) => r?.doi && !r.retraction);
  const { byDoi, checked, errors } = await checkRetractions(pending.map((r) => r.doi), options);

  for (const paper of pending) {
    const found = byDoi.get(normalizeDoi(paper.doi));
    // Yanit gelmediyse 'unknown', 'none' DEGIL. Iki durum boyle olur: DOI'nin
    // batch'i basarisiz oldu, ya da DOI Crossref'te kayitli degil (or. arXiv'in
    // DataCite DOI'leri). Ikisinde de "geri cekilmemis" demek icin kanit yok.
    paper.retraction = found || { status: 'unknown', notices: [] };
  }

  const all = (results || []).filter((r) => r?.retraction);
  const summary = {
    retracted: all.filter((r) => r.retraction.status === 'retracted').length,
    concern: all.filter((r) => r.retraction.status === 'concern').length,
    checked,
    errors,
  };

  if (errors.length > 0) {
    console.warn(JSON.stringify({ event: 'RETRACTION_CHECK_FAILED', errors, checked }));
  }
  if (summary.retracted > 0) {
    console.log(`[Retraction] ${summary.retracted} geri cekilmis makale isaretlendi (${checked} DOI kontrol edildi)`);
  }

  return summary;
}
