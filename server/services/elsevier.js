import { fetch } from "undici";
import { normalizeData } from "../utils/normalization.js";
import { calculateAHP } from "./ahp.js";

const REQUEST_TYPE = "GET";
const API_URL = "https://api.elsevier.com";

async function fetchPage(query, start, count) {
    const apiKey = process.env.ELSEVIER_API_KEY;
    const url = `${API_URL}/content/search/scopus?query=${encodeURIComponent(query)}&view=STANDARD&sort=relevance&count=${count}&start=${start}`;

    console.log("Fetching Scopus URL:", url);
    const resp = await fetch(url, {
        method: REQUEST_TYPE,
        headers: {
            "Accept": "application/json",
            "X-ELS-APIKey": apiKey,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        }
    });

    const quotaInfo = {
        limit: resp.headers.get("X-RateLimit-Limit") || resp.headers.get("x-ratelimit-limit"),
        remaining: resp.headers.get("X-RateLimit-Remaining") || resp.headers.get("x-ratelimit-remaining"),
        reset: resp.headers.get("X-RateLimit-Reset") || resp.headers.get("x-ratelimit-reset") || resp.headers.get("retry-after"),
        status: resp.headers.get("X-ELS-Status") || resp.headers.get("x-els-status")
    };

    if (resp.status !== 200) {
        // Debug için tüm başlıkları terminale basalım
        console.log("--- TÜM API BAŞLIKLARI (DEBUG) ---");
        resp.headers.forEach((v, k) => console.log(`${k}: ${v}`));

        let resetDate = "Bilinmiyor";
        if (quotaInfo.reset) {
            // Eğer reset bir sayıysa (Epoch) tarihe çevir, değilse olduğu gibi yaz (Retry-After saniye olabilir)
            if (!isNaN(quotaInfo.reset)) {
                resetDate = new Date(parseInt(quotaInfo.reset) * 1000).toLocaleString('tr-TR');
            } else {
                resetDate = quotaInfo.reset + " saniye sonra";
            }
        }

        const cleanStatus = (quotaInfo.status || "Hız Sınırı").split('-')[0].trim();

        console.error(`\n--- ELSEVIER API HATASI (${resp.status}) ---`);
        console.error(`Durum: ${cleanStatus}`);
        console.error(`Kalan Kota: ${quotaInfo.remaining || 0} / ${quotaInfo.limit || "Bilinmiyor"}`);
        console.error(`Sıfırlanma: ${resetDate}`);
        
        let errBody = "";
        try { errBody = await resp.text(); } catch(e){}
        console.error(`Hata Body:`, errBody);
        console.error(`--------------------------------------\n`);

        if (cleanStatus === "QUOTA_EXCEEDED") {
            throw new Error(`Kotanız Dolmuş. Yenilenme: ${resetDate}`);
        }
        throw new Error(`API Hatası (${resp.status}): ${cleanStatus}. Yenilenme: ${resetDate}`);
    }

    const data = await resp.json();
    return { data, quotaInfo };
}

export async function searchLiterature(query, count, weights = null) {
    const chunkSize = 25;
    let rawListings = [];
    let lastQuota = null;

    // Initial fetch to get total results
    const { data: firstPage, quotaInfo } = await fetchPage(query, 0, chunkSize);
    lastQuota = quotaInfo;

    if (!firstPage["search-results"]) {
        throw new Error("Invalid API response from Elsevier");
    }

    const totalResults = parseInt(firstPage["search-results"]["opensearch:totalResults"]) || 0;
    const initialEntry = firstPage["search-results"].entry || [];
    rawListings.push(...initialEntry);

    console.log(`Total found: ${totalResults}. Requested: ${count}`);

    // Fetch more pages if needed
    const numItemsNeeded = Math.min(count, totalResults, 5000); // Scopus limit
    const maxPages = Math.ceil(numItemsNeeded / chunkSize);

    for (let i = 1; i < maxPages; i++) {
        const start = i * chunkSize;

        try {
            const { data: pageData, quotaInfo: pQuota } = await fetchPage(query, start, chunkSize);
            lastQuota = pQuota;

            if (pageData["search-results"] && pageData["search-results"].entry) {
                rawListings.push(...pageData["search-results"].entry);
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (err) {
            console.error("Pagination error:", err);
            break; 
        }
    }

    // Normalize Data
    console.log(`Normalizing ${rawListings.length} raw items...`);
    let cleanData = await normalizeData(rawListings, query);

    // Apply AHP
    console.log("Calculating AHP scores...");
    const rankedData = await calculateAHP(cleanData, weights);

    let resetDate = "Bilinmiyor";
    if (lastQuota && lastQuota.reset) {
        resetDate = new Date(parseInt(lastQuota.reset) * 1000).toLocaleString('tr-TR');
    }

    return {
        totalFound: totalResults,
        analyzedCount: rankedData.length,
        results: rankedData.slice(0, 500), 
        quota: {
            limit: lastQuota?.limit,
            remaining: lastQuota?.remaining,
            reset: resetDate
        }
    };
}
