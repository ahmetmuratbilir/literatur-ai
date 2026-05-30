import { normalizeData } from '../utils/normalization.js';
import { fetchWithTimeout } from '../utils/http.js';

const REQUEST_TYPE = 'GET';
const API_URL = 'https://api.elsevier.com';
const SCOPUS_TIMEOUT_MS = 15000;
const SCOPUS_MAX_ATTEMPTS = 2;

const getApiKey = () => process.env.ELSEVIER_API_KEY || process.env.SCOPUS_API_KEY || '';
const getInstToken = () => process.env.ELSEVIER_INSTTOKEN || process.env.SCOPUS_INSTTOKEN || '';

const SCOPUS_FALLBACK_STOPWORDS = new Set([
  'and', 'or', 'the', 'for', 'with', 'from', 'into', 'over', 'under', 'between',
  'this', 'that', 'these', 'those', 'effect', 'effects', 'impact', 'impacts',
  'alanindaki', 'etkileri', 'icin', 'ile', 've', 'bir', 'bu', 'su', 'olan',
]);

const isRetryableNetworkError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError'
    || message.includes('timeout')
    || message.includes('fetch failed')
    || message.includes('network');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildFallbackQuery(queryContext) {
  const terms = String(queryContext || '')
    .toLowerCase()
    .replace(/["'()]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !SCOPUS_FALLBACK_STOPWORDS.has(term));

  const termSet = new Set(terms);
  const concepts = [];

  if (termSet.has('artificial') && termSet.has('intelligence')) {
    concepts.push('"artificial intelligence"');
  }
  if (termSet.has('machine') && termSet.has('learning')) {
    concepts.push('"machine learning"');
  }
  if (termSet.has('deep') && termSet.has('learning')) {
    concepts.push('"deep learning"');
  }
  if (termSet.has('medical') && termSet.has('imaging')) {
    concepts.push('"medical imaging"');
  }
  if (['healthcare', 'health', 'medical', 'saglik'].some((term) => termSet.has(term))) {
    concepts.push('(healthcare OR health OR medical)');
  }
  if (['ethics', 'ethical', 'ethic', 'etik'].some((term) => termSet.has(term))) {
    concepts.push('(ethic* OR ethical OR ethics)');
  }

  if (concepts.length >= 2) {
    return `TITLE-ABS-KEY(${concepts.join(' AND ')})`;
  }

  const uniqueTerms = [...new Set(terms)].slice(0, 8);
  if (uniqueTerms.length === 0) return '';
  return `TITLE-ABS-KEY(${uniqueTerms.join(' OR ')})`;
}

function buildHeaders() {
  const apiKey = getApiKey();
  const instToken = getInstToken();
  const headers = {
    Accept: 'application/json',
    'X-ELS-APIKey': apiKey,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  };

  if (instToken) {
    headers['X-ELS-Insttoken'] = instToken;
  }

  return headers;
}

function formatResetDate(resetValueRaw) {
  if (!resetValueRaw) return 'Bilinmiyor';
  const resetValue = Number.parseInt(resetValueRaw, 10);
  if (!Number.isFinite(resetValue)) return String(resetValueRaw);

  const resetTime = resetValue < 10000000000 ? resetValue * 1000 : resetValue;
  return new Date(resetTime).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function buildElsevierError(response, quotaInfo) {
  const instToken = getInstToken();
  const cleanStatus = String(quotaInfo.status || 'RATE_LIMIT')
    .split('-')[0]
    .trim();
  const resetDate = formatResetDate(quotaInfo.reset);
  const bodyPreview = (await response.text().catch(() => ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  console.error(`\n--- ELSEVIER API ERROR (${response.status}) ---`);
  console.error(`Status: ${cleanStatus}`);
  console.error(`Remaining quota: ${quotaInfo.remaining || 0} / ${quotaInfo.limit || 'Bilinmiyor'}`);
  console.error(`Reset: ${resetDate}`);
  console.error(`Insttoken sent: ${instToken ? 'yes' : 'no'}`);
  if (bodyPreview) {
    console.error(`Body preview: ${bodyPreview}`);
  }

  if (cleanStatus === 'QUOTA_EXCEEDED' || response.status === 429) {
    return new Error(`Kotaniz dolmus. Yenilenme: ${resetDate}`);
  }

  if (response.status === 401 || cleanStatus === 'AUTHENTICATION_ERROR') {
    const hints = [
      'ELSEVIER_API_KEY set ama Scopus API yetkisi eksik olabilir.',
      instToken
        ? 'X-ELS-Insttoken gonderildi.'
        : 'X-ELS-Insttoken gonderilmiyor; kurumsal erisim gerekiyorsa ELSEVIER_INSTTOKEN eklenmeli.',
      'Elsevier Developer Portal tarafinda Scopus API access aktif olmali.',
      'Kurumsal abonelik veya IP tabanli yetki gerekiyor olabilir.',
    ];
    return new Error(`API Hatasi (401): ${cleanStatus}. ${hints.join(' ')}`);
  }

  return new Error(`API Hatasi (${response.status}): ${cleanStatus}. Yenilenme: ${resetDate}`);
}

async function fetchPage(query, start, count) {
  const currentYear = new Date().getFullYear();
  const dateRange = `${currentYear - 5}-${currentYear}`;
  const url = `${API_URL}/content/search/scopus?query=${encodeURIComponent(query)}&sort=relevance&count=${count}&start=${start}&date=${dateRange}&field=dc:title,dc:creator,prism:publicationName,prism:coverDate,dc:description,citedby-count,prism:doi,link,subtypeDescription,authkeywords,prism:teaser,prism:aggregationType,openaccessArticle`;

  console.log('Scopus API istegi yapiliyor:', url);

  let response;
  for (let attempt = 1; attempt <= SCOPUS_MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await fetchWithTimeout(url, {
        method: REQUEST_TYPE,
        headers: buildHeaders(),
      }, SCOPUS_TIMEOUT_MS);
      break;
    } catch (error) {
      const canRetry = attempt < SCOPUS_MAX_ATTEMPTS && isRetryableNetworkError(error);
      if (!canRetry) throw error;
      console.warn(`[Scopus] Gecici ag hatasi, tekrar deneniyor (${attempt}/${SCOPUS_MAX_ATTEMPTS - 1})`);
      await sleep(800);
    }
  }

  const quotaInfo = {
    limit: response.headers.get('X-RateLimit-Limit') || response.headers.get('x-ratelimit-limit'),
    remaining:
      response.headers.get('X-RateLimit-Remaining') || response.headers.get('x-ratelimit-remaining'),
    reset:
      response.headers.get('X-RateLimit-Reset') ||
      response.headers.get('x-ratelimit-reset') ||
      response.headers.get('retry-after'),
    status: response.headers.get('X-ELS-Status') || response.headers.get('x-els-status'),
  };

  if (response.status !== 200) {
    throw await buildElsevierError(response, quotaInfo);
  }

  const data = await response.json();
  return { data, quotaInfo };
}

export async function searchLiterature(query, count, weights = null, queryContext) {
  if (!getApiKey().trim()) {
    console.warn('[Scopus] ELSEVIER_API_KEY/SCOPUS_API_KEY tanimli degil; Scopus atlaniyor.');
    return { totalFound: 0, results: [], quotaInfo: {} };
  }

  if (!getInstToken()) {
    console.warn('[Scopus] ELSEVIER_INSTTOKEN tanimli degil. Kurumsal erisim gerekiyorsa 401 alinabilir.');
  }

  const chunkSize = 25;
  const rawListings = [];
  let lastQuota = null;
  let totalResults = 0;

  try {
    let activeQuery = query;
    const { data: firstPage, quotaInfo } = await fetchPage(query, 0, chunkSize);
    lastQuota = quotaInfo;

    if (!firstPage['search-results']) {
      throw new Error("Elsevier API'sinden gecersiz yanit alindi.");
    }

    totalResults = Number.parseInt(firstPage['search-results']['opensearch:totalResults'], 10) || 0;
    let initialEntry = firstPage['search-results'].entry || [];

    if (totalResults === 0 && queryContext) {
      const fallbackQuery = buildFallbackQuery(queryContext);
      if (fallbackQuery && fallbackQuery !== query) {
        console.warn(`[Scopus] Exact query returned 0 results. Retrying with fallback query: ${fallbackQuery}`);
        const fallbackPage = await fetchPage(fallbackQuery, 0, chunkSize);
        activeQuery = fallbackQuery;
        lastQuota = fallbackPage.quotaInfo;

        if (fallbackPage.data['search-results']) {
          totalResults = Number.parseInt(
            fallbackPage.data['search-results']['opensearch:totalResults'],
            10
          ) || 0;
          initialEntry = fallbackPage.data['search-results'].entry || [];
        }
      }
    }

    rawListings.push(...initialEntry);

    console.log(`[Scopus] Toplam bulunan: ${totalResults}. Istenen: ${count}`);

    const numItemsNeeded = Math.min(count, totalResults, 5000);
    const maxPages = Math.ceil(numItemsNeeded / chunkSize);

    for (let index = 1; index < maxPages; index += 1) {
      const start = index * chunkSize;

      try {
        const { data: pageData, quotaInfo: pageQuota } = await fetchPage(activeQuery, start, chunkSize);
        lastQuota = pageQuota;

        if (pageData['search-results']?.entry) {
          rawListings.push(...pageData['search-results'].entry);
        }

        await sleep(800);
      } catch (error) {
        console.error('[Scopus] Sayfalama hatasi:', error);
        break;
      }
    }

    console.log(`[Scopus] ${rawListings.length} oge normalize ediliyor...`);
    const cleanData = await normalizeData(rawListings, queryContext || query);

    return {
      totalFound: totalResults,
      results: cleanData,
      quotaInfo: lastQuota,
    };
  } catch (error) {
    console.error('[Scopus] Arama hatasi:', error.message);
    throw error;
  }
}
