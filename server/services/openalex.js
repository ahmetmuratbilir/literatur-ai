import pkg from 'natural';
import { fetchWithTimeout, maskUrlSecret } from '../utils/http.js';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

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

export async function searchOpenAlex(queryContext, params, booleanQuery) {
  const ctx = String(queryContext ?? '');
  const { mainTopic, authorName, keywords, count } = params;
  const apiKey = process.env.OPENALEX_API_KEY;

  // Eğer strict booleanQuery (AND'li) gönderilmişse onu kullan, yoksa düz ctx
  const searchQuery = booleanQuery || ctx || (mainTopic ? mainTopic : '');

  // Eğer hiçbir şey girilmediyse boş dön
  if (!searchQuery && !authorName) return { results: [], quotaInfo: {} };

  const urlParams = new URLSearchParams();
  urlParams.set('per-page', String(count || 25));

  if (searchQuery) {
    urlParams.set('search', searchQuery);
  }

  const mailto = process.env.CONTACT_EMAIL || 'ahmet@literatureai.com';
  if (mailto) urlParams.set('mailto', mailto);

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

        const normalized = {};
        normalized.id = item.id;
        normalized.title = titleText;
        normalized.creator = item.authorships?.map(a => a.author?.display_name).join(', ') || 'Bilinmeyen';
        normalized.publicationName = item.primary_location?.source?.display_name || 'Bilinmeyen Kaynak';
        normalized.coverDate = item.publication_date || `${item.publication_year}-01-01`;
        normalized.description = abstractText;
        normalized.year = item.publication_year || 2000;
        normalized.citedBy = item.cited_by_count || 0;
        normalized.url = openAlexLinkUrl(item);
        normalized.source = 'OpenAlex';

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
