import { fetch } from 'undici';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeData } from '../utils/normalization.js';
import { calculateAHP } from './ahp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REQUEST_TYPE = 'GET';
const API_URL = 'https://api.elsevier.com';

async function fetchPage(query, start, count) {
  const apiKey = process.env.ELSEVIER_API_KEY;
  const url = `${API_URL}/content/search/scopus?query=${encodeURIComponent(query)}&view=STANDARD&sort=relevance&count=${count}&start=${start}`;

  console.log('Scopus API isteği yapılıyor:', url);

  const response = await fetch(url, {
    method: REQUEST_TYPE,
    headers: {
      Accept: 'application/json',
      'X-ELS-APIKey': apiKey,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    },
  });

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
    let resetDate = 'Bilinmiyor';
    if (quotaInfo.reset) {
      const resetValue = Number.parseInt(quotaInfo.reset, 10);
      const resetTime = resetValue < 10000000000 ? resetValue * 1000 : resetValue;
      resetDate = new Date(resetTime).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const cleanStatus = (quotaInfo.status || 'Hız Sınırı').split('-')[0].trim();

    console.error(`\n--- ELSEVIER API HATASI (${response.status}) ---`);
    console.error(`Durum: ${cleanStatus}`);
    console.error(`Kalan Kota: ${quotaInfo.remaining || 0} / ${quotaInfo.limit || 'Bilinmiyor'}`);
    console.error(`Sıfırlanma: ${resetDate}`);

    if (cleanStatus === 'QUOTA_EXCEEDED' || response.status === 429) {
      throw new Error(`Kotanız dolmuş. Yenilenme: ${resetDate}`);
    }

    throw new Error(`API Hatası (${response.status}): ${cleanStatus}. Yenilenme: ${resetDate}`);
  }

  const data = await response.json();
  return { data, quotaInfo };
}

export async function searchLiterature(query, count, weights = null) {
  const chunkSize = 25;
  const rawListings = [];
  let lastQuota = null;

  try {
    const { data: firstPage, quotaInfo } = await fetchPage(query, 0, chunkSize);
    lastQuota = quotaInfo;

    if (!firstPage['search-results']) {
      throw new Error("Elsevier API'sinden geçersiz yanıt alındı.");
    }

    const totalResults = Number.parseInt(firstPage['search-results']['opensearch:totalResults'], 10) || 0;
    const initialEntry = firstPage['search-results'].entry || [];
    rawListings.push(...initialEntry);

    console.log(`Toplam bulunan: ${totalResults}. İstenen: ${count}`);

    const numItemsNeeded = Math.min(count, totalResults, 5000);
    const maxPages = Math.ceil(numItemsNeeded / chunkSize);

    for (let index = 1; index < maxPages; index += 1) {
      const start = index * chunkSize;

      try {
        const { data: pageData, quotaInfo: pageQuota } = await fetchPage(query, start, chunkSize);
        lastQuota = pageQuota;

        if (pageData['search-results']?.entry) {
          rawListings.push(...pageData['search-results'].entry);
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        console.error('Sayfalama hatası:', error);
        break;
      }
    }

    console.log(`${rawListings.length} öğe normalize ediliyor...`);
    const cleanData = await normalizeData(rawListings, query);

    console.log('AHP skorları hesaplanıyor...');
    const rankedData = await calculateAHP(cleanData, weights);

    let resetDate = 'Bilinmiyor';
    if (lastQuota?.reset) {
      const resetValue = Number.parseInt(lastQuota.reset, 10);
      const resetTime = resetValue < 10000000000 ? resetValue * 1000 : resetValue;
      resetDate = new Date(resetTime).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return {
      totalFound: totalResults,
      analyzedCount: rankedData.length,
      results: rankedData.slice(0, 500),
      quota: {
        limit: lastQuota?.limit,
        remaining: lastQuota?.remaining,
        reset: resetDate,
      },
    };
  } catch (error) {
    let resetDate = 'Bilinmiyor';
    if (lastQuota?.reset) {
      const resetValue = Number.parseInt(lastQuota.reset, 10);
      const resetTime = resetValue < 10000000000 ? resetValue * 1000 : resetValue;
      resetDate = new Date(resetTime).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    if (error.message.includes('429') || error.message.includes('Kotanız')) {
      console.log('--- KOTA DOLU: DEMO MODUNA GEÇİLİYOR ---');

      try {
        const exDataPath = path.join(__dirname, '../../exdata.json');
        const rawExData = await fs.readFile(exDataPath, 'utf-8');
        const exData = JSON.parse(rawExData);

        console.log(`Demo modu aktif: ${exData.length} yerel kayıt yüklendi.`);

        const delay = Math.floor(Math.random() * 1000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));

        const cleanData = await normalizeData(exData, query);
        const rankedData = await calculateAHP(cleanData, weights);

        return {
          totalFound: exData.length,
          analyzedCount: rankedData.length,
          results: rankedData.slice(0, count || 10),
          demoMode: true,
          quota: { limit: 1000, remaining: 0, reset: resetDate },
        };
      } catch (fileError) {
        console.error('Demo verisi yüklenirken hata:', fileError);
      }
    }

    error.quota = {
      limit: lastQuota?.limit,
      remaining: lastQuota?.remaining,
      reset: resetDate,
    };

    throw error;
  }
}
