import axios from 'axios';
import { normalizePublicationDate } from '../utils/dateNormalization.js';

/**
 * Europe PMC — tip ve yasam bilimleri literaturu (PubMed kayitlarini da
 * iceriyor), acik erisim tam metin, MeSH. Anahtar gerektirmez.
 *
 * Erisim: IP basina ~10 istek/sn belgelenmis (dogrulanmali); arama basina tek
 * istek atiyoruz, sinira yakin degiliz.
 *
 * Neden canli aramada ve KOSULSUZ: plan "yalnizca tip/biyoloji sorgularinda"
 * diyordu, gerekce 3 sn arama butcesiydi. Ama kaynaklar Promise.allSettled ile
 * PARALEL cagriliyor; Europe PMC ~0,6 sn ile en hizlilardan, toplam sureyi
 * uzatmiyor. Konu disi sonuclari alaka esigi (relevanceGate) zaten eliyor.
 * Olculen (30 Eyl 2026): "nuclear reactor safety" -> 59, "diabetes treatment"
 * -> 26.000 sonuc.
 *
 * Sorgu dili OpenAlex ile ayni boolean bicimi anliyor: "ifade", AND/OR/NOT,
 * parantez. services/sourceQuery.js ayni ciktiyi kullaniyor.
 *
 * Lisans: metadata serbest; tam metnin telifi yayincida. `openAccess` ve PMC
 * linki gosterilir, PDF barindirilmaz.
 */
const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

function stripTags(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function articleUrl(r) {
  if (r.pmcid) return `https://europepmc.org/article/PMC/${r.pmcid}`;
  if (r.source && r.id) return `https://europepmc.org/article/${r.source}/${r.id}`;
  return r.doi ? `https://doi.org/${r.doi}` : '';
}

/**
 * Ham Europe PMC kaydini ortak makale bicimine cevirir. Saf fonksiyon (test icin).
 */
export function mapEuropePmcResult(r) {
  const dateMetadata = normalizePublicationDate({
    firstPublicationDate: r.firstPublicationDate || null,
    pubYear: r.pubYear || null,
  }, 'EuropePMC');

  const pubTypes = Array.isArray(r.pubTypeList?.pubType) ? r.pubTypeList.pubType : [];
  // PPR = preprint sunuculari (bioRxiv, medRxiv...). Kalite kriterinde hakemli
  // dergi makalesiyle ayni puani almamali.
  const isPreprint = r.source === 'PPR';

  return {
    id: `epmc-${r.source || 'X'}-${r.id}`,
    title: stripTags(r.title).replace(/\.$/, '') || 'Untitled Paper',
    creator: r.authorString ? String(r.authorString).replace(/\.$/, '') : 'Unknown Authors',
    authors: r.authorString ? String(r.authorString).replace(/\.$/, '') : 'Unknown Authors',
    publicationName: r.journalInfo?.journal?.title || r.bookOrReportDetails?.publisher || (isPreprint ? 'Preprint' : 'N/A'),
    ...dateMetadata,
    year: dateMetadata.publicationYear ?? null,
    doi: r.doi || '',
    volume: r.journalInfo?.volume || null,
    issue: r.journalInfo?.issue || null,
    pages: r.pageInfo || null,
    pmid: r.pmid || null,
    pmcid: r.pmcid || null,
    url: articleUrl(r),
    citedBy: Number.parseInt(r.citedByCount, 10) || 0,
    description: stripTags(r.abstractText).substring(0, 500),
    source: 'Europe PMC',
    // Kalite kriteri icin ham tur; normalizePublicationType bunu cozuyor.
    type: isPreprint ? 'preprint' : (pubTypes.find((t) => /journal article|review/i.test(t)) || pubTypes[0] || null),
    sourceType: isPreprint ? 'Preprint' : undefined,
    openAccess: r.isOpenAccess === 'Y',
    // Europe PMC'nin kendi bildirdigi yasal PDF kopyasi; kartta dogrudan gosterilir.
    pdfUrl: (Array.isArray(r.fullTextUrlList?.fullTextUrl)
      ? r.fullTextUrlList.fullTextUrl.find((u) => u.documentStyle === 'pdf' && u.availabilityCode === 'OA')?.url
      : null) || null,
    keyCount: 0,
  };
}

export async function searchEuropePMC(query, count = 25) {
  if (!query || !String(query).trim()) {
    return { results: [], totalFound: 0 };
  }
  try {
    console.log(`[EuropePMC] İstek: q="${String(query).slice(0, 80)}" pageSize=${count}`);
    const response = await axios.get(BASE, {
      params: {
        query,
        format: 'json',
        resultType: 'core',
        pageSize: Math.min(count, 100),
      },
      timeout: 8000,
    });

    const list = response.data?.resultList?.result;
    if (!Array.isArray(list)) {
      console.warn('[EuropePMC] Yanıtta resultList yok');
      return { results: [], totalFound: 0 };
    }

    const totalFound = Number(response.data.hitCount) || 0;
    console.log(`[EuropePMC] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${list.length}`);
    return { results: list.map(mapEuropePmcResult), totalFound };
  } catch (error) {
    console.error('Europe PMC API Hatası:', error.message);
    throw error;
  }
}
