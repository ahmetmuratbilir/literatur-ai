import pkg from 'natural';
import { fetchWithTimeout, maskUrlSecret } from '../utils/http.js';
import { normalizePublicationDate } from '../utils/dateNormalization.js';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

/** "123" + "130" -> "123-130"; tek sayfa veya bos alanlar korunur. */
function pageRange(first, last) {
  if (!first) return null;
  return last && String(last) !== String(first) ? `${first}-${last}` : String(first);
}

// Inverted index'i düz metne çevirir
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const wordMap = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordMap[pos] = word;
    }
  }
  return wordMap.filter(Boolean).join(' ');
}

function openAlexWorkTitle(title) {
  if (title == null) return '';
  if (typeof title === 'string') return title.trim();
  if (typeof title === 'object') {
    if (typeof title.en === 'string') return title.en.trim();
    const found = Object.values(title).find((v) => typeof v === 'string');
    return found ? String(found).trim() : '';
  }
  return String(title).trim();
}

function openAlexLinkUrl(item) {
  const id = item?.id ? String(item.id) : '';
  if (id.startsWith('http')) return id;
  if (item?.doi) {
    const d = String(item.doi).replace(/^https?:\/\/doi\.org\//i, '');
    return `https://doi.org/${d}`;
  }
  return id;
}

function logDateNormalization(sourceName, dateMetadata) {
  const sourceField = dateMetadata.dateSource
    ? dateMetadata.dateSource.replace(`${sourceName} `, '')
    : 'unknown';
  const selectedYear = dateMetadata.publicationYear ?? dateMetadata.metadataYear ?? null;
  console.log(`[DATE] ${sourceName} → ${sourceField} → ${selectedYear ?? 'null'} (${dateMetadata.yearConfidence})`);
}

export async function searchOpenAlex(queryContext, params, booleanQuery, options = {}) {
  const ctx = String(queryContext ?? '');
  const { mainTopic, authorName, keywords, count } = params;

  // Ucretsiz OpenAlex anahtari (openalex.org hesabindan). Tanimliysa gonderilir.
  //
  // Onceki surum bu degiskeni okuyup HIC gondermiyordu. Olculen (30 Eyl 2026):
  //  - Anahtarsiz istek normalde 200 donuyor, AMA arama kumesi yuk altindayken
  //    anonim arama 429 ile kesiliyor ("Anonymous search is temporarily
  //    rate-limited ... use a free API key for uninterrupted access").
  //  - GECERSIZ bir api_key ise 401 donuyor ve kaynagi tamamen dusuruyor.
  // Bu yuzden anahtar gonderiliyor ama dogrulanmadan eklenmemeli:
  // `npm run verify-keys` gecersiz anahtari ANAHTAR GECERSIZ olarak gosterir.
  const apiKey = process.env.OPENALEX_API_KEY?.trim();

  // Eğer strict booleanQuery (AND'li) gönderilmişse onu kullan, yoksa düz ctx
  const searchQuery = booleanQuery || ctx || (mainTopic ? mainTopic : '');

  // Eğer hiçbir şey girilmediyse boş dön
  if (!searchQuery && !authorName) return { results: [], quotaInfo: {} };

  const urlParams = new URLSearchParams();
  urlParams.set('per-page', String(count || 25));

  if (searchQuery) {
    urlParams.set('search', searchQuery);
  }
  // Ornek: 'language:tr' (Turkce kaynaklar icin ek arama)
  if (options.filter) urlParams.set('filter', options.filter);

  const mailto = process.env.OPENALEX_MAIL || process.env.CONTACT_EMAIL || 'ahmet@literatureai.com';
  if (mailto) urlParams.set('mailto', mailto);
  // Loglarda maskUrlSecret() bu parametreyi *** ile gizliyor.
  if (apiKey) urlParams.set('api_key', apiKey);

  const url = `https://api.openalex.org/works?${urlParams.toString()}`;

  const requestHeaders = {
    Accept: 'application/json',
    'User-Agent': `LiteratureAI/1.0 (mailto:${mailto})`,
  };

  console.log('OpenAlex API isteği yapılıyor:', maskUrlSecret(url));

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: requestHeaders,
    });

    const quotaInfo = {
      limit: response.headers.get('X-RateLimit-Limit') || response.headers.get('x-ratelimit-limit'),
      remaining: response.headers.get('X-RateLimit-Remaining') || response.headers.get('x-ratelimit-remaining'),
      reset: response.headers.get('X-RateLimit-Reset') || response.headers.get('x-ratelimit-reset'),
    };

    if (!response.ok) {
      console.error(`OpenAlex API Hatası: ${response.status}`);
      const errorMsg = response.status === 429 ? 'OpenAlex kotası doldu (429).' : `OpenAlex API Hatası (${response.status})`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const totalFound = data.meta?.count || 0;
    console.log(`[OpenAlex] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${(data.results || []).length}`);

    // Verileri normalize et
    const rawListings = data.results || [];
    const cleaned = [];

    for (const item of rawListings) {
      try {
        const titleText = openAlexWorkTitle(item.title);
        if (!titleText) continue;

        const abstractText = reconstructAbstract(item.abstract_inverted_index);
        const dateMetadata = normalizePublicationDate(item, 'OpenAlex');
        logDateNormalization('OpenAlex', dateMetadata);

        const normalized = {};
        normalized.id = item.id;
        normalized.title = titleText;
        normalized.creator = item.authorships?.map(a => a.author?.display_name).join(', ') || 'Bilinmeyen';
        normalized.publicationName = item.primary_location?.source?.display_name || 'Bilinmeyen Kaynak';
        normalized.coverDate = dateMetadata.publicationDate || null;
        normalized.description = abstractText;
        Object.assign(normalized, dateMetadata);
        normalized.year = dateMetadata.publicationYear ?? null;
        normalized.citedBy = item.cited_by_count || 0;
        // Alana ve yila gore normalize atif (OpenAlex hesapliyor, ek istek yok).
        // citation_normalized_percentile.value: ayni alan + yildaki eserlerin
        // yuzde kacindan fazla atif aldigi (0-1). fwci: alan ortalamasina oran.
        const pct = item.citation_normalized_percentile;
        normalized.citationPercentile = typeof pct?.value === 'number' ? pct.value : null;
        normalized.topCitedPercent = pct?.is_in_top_1_percent ? 1 : (pct?.is_in_top_10_percent ? 10 : null);
        normalized.fwci = typeof item.fwci === 'number' ? item.fwci : null;
        normalized.url = openAlexLinkUrl(item);
        // DOI eskiden yalnizca link icin okunuyordu; kayda yazilmadigi icin
        // geri cekme kontrolu, Unpaywall ve kaynakca OpenAlex makalelerini
        // DOI'siz goruyordu.
        normalized.doi = item.doi ? String(item.doi).replace(/^https?:\/\/doi\.org\//i, '') : '';
        // Kaynakca kunyesi: DOI'si olmayan makalede de cilt/sayi/sayfa kalsin.
        normalized.volume = item.biblio?.volume || null;
        normalized.issue = item.biblio?.issue || null;
        normalized.pages = pageRange(item.biblio?.first_page, item.biblio?.last_page);
        normalized.source = 'OpenAlex';
        // AHP kalite ve acik erisim kriterleri icin ham alanlar.
        normalized.type = item.type || null;
        normalized.openAccess = Boolean(item.open_access?.is_oa);

        // Dergi DOAJ'da listeli mi. OpenAlex kaynak nesnesi bunu dogrudan
        // tasiyor; DOAJ'a ayri istek gerekmiyor. Capraz dogrulandi (30 Eyl
        // 2026): OpenAlex true -> DOAJ ISSN aramasi total=1; false -> total=0.
        const venue = item.primary_location?.source;
        normalized.issnL = venue?.issn_l || null;
        normalized.isInDoaj = typeof venue?.is_in_doaj === 'boolean' ? venue.is_in_doaj : null;

        // Keyword count (AHP için)
        let keyCount = 0;
        const queryTokens = tokenizer.tokenize(ctx.toLowerCase());

        if (normalized.title) {
          const titleTokens = tokenizer.tokenize(normalized.title.toLowerCase());
          titleTokens.forEach(t => {
            if (queryTokens.includes(t)) keyCount += 3;
          });
        }

        if (normalized.description) {
          const descTokens = tokenizer.tokenize(normalized.description.toLowerCase());
          descTokens.forEach(t => {
            if (queryTokens.includes(t)) keyCount += 1;
          });
        }
        normalized.keyCount = keyCount;

        cleaned.push(normalized);
      } catch (e) {
        console.warn("OpenAlex item normalize edilemedi", e.message);
      }
    }

    return { results: cleaned, quotaInfo, totalFound };
  } catch (error) {
    console.error('OpenAlex fetch hatası:', error.message);
    throw error;
  }
}
