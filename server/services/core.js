import pkg from 'natural';
import { fetchWithTimeout } from '../utils/http.js';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

export async function searchCore(queryContext, params, booleanQuery) {
  const ctx = String(queryContext ?? '');
  const { mainTopic, authorName, keywords, count } = params;
  const apiKey = process.env.CORE_API_KEY;
  
  // Eğer hiçbir şey girilmediyse boş dön
  if (!mainTopic && !authorName && (!keywords || keywords.length === 0)) return { results: [], quotaInfo: {} };

  // Eğer strict booleanQuery (AND'li) gönderilmişse onu kullan, yoksa düz ctx
  let searchQuery = booleanQuery || ctx;

  // Yazar varsa fielded olarak ekle
  if (authorName) {
    searchQuery = searchQuery.trim()
      ? `(${searchQuery}) AND authors:"${authorName}"`
      : `authors:"${authorName}"`;
  }

  // Hiçbir terim yoksa boş dön
  if (!searchQuery.trim()) return { results: [], quotaInfo: {} };

  const limit = count || 25;
  const url = `https://api.core.ac.uk/v3/search/works/?q=${encodeURIComponent(searchQuery)}&limit=${limit}`;

  console.log('CORE API isteği yapılıyor:', url);

  try {
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'LiteratureAI/1.0',
    };
    
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithTimeout(url, { method: 'GET', headers });

    const quotaInfo = {
      limit: response.headers.get('x-ratelimit-limit') || 5000,
      remaining: response.headers.get('x-ratelimit-remaining') || 'Bilinmiyor',
      reset: response.headers.get('x-ratelimit-retry-after') || 'Bilinmiyor', // CORE uses retry-after in seconds usually
    };

    if (!response.ok) {
       console.error(`CORE API Hatası: ${response.status}`);
       const errorMsg = response.status === 429 ? 'CORE kotası doldu (429).' : `CORE API Hatası (${response.status})`;
       throw new Error(errorMsg);
    }

    const data = await response.json();
    const totalFound = data.totalHits || 0;
    console.log(`[CORE] Toplam havuz: ${totalFound.toLocaleString()}. Çekilen: ${(data.results || []).length}`);
    
    // Verileri normalize et
    const rawListings = data.results || [];
    const cleaned = [];

    for (const item of rawListings) {
      try {
        if (!item.title) continue;

        const normalized = {};
        normalized.id = item.id ? `core_${item.id}` : `core_${Math.random().toString(36).slice(2)}`;
        normalized.title = String(item.title).trim();
        
        normalized.creator = 'Bilinmeyen';
        if (item.authors && Array.isArray(item.authors)) {
             normalized.creator = item.authors.map(a => a.name).filter(Boolean).join(', ') || 'Bilinmeyen';
        }
        
        normalized.publicationName = item.publisher || item.journals?.[0]?.title || 'Bilinmeyen Kaynak';
        normalized.coverDate = item.publishedDate || `${item.yearPublished || 2000}-01-01`;
        normalized.description = item.abstract || '';
        normalized.year = parseInt(item.yearPublished, 10) || 2000;
        normalized.citedBy = parseInt(item.citationCount, 10) || 0;
        
        // URL: ensure it is always a string
        const rawCoreUrl = item.downloadUrl || (Array.isArray(item.sourceFulltextUrls) ? item.sourceFulltextUrls[0] : null) || '';
        normalized.url = rawCoreUrl ? String(rawCoreUrl) : `https://core.ac.uk/works/${item.id || ''}`;
        normalized.source = 'CORE';

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
        console.warn("CORE item normalize edilemedi", e.message);
      }
    }

    return { results: cleaned, quotaInfo, totalFound };
  } catch (error) {
    console.error('CORE fetch hatası:', error.message);
    throw error;
  }
}
