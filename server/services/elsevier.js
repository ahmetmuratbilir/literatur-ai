import { fetch } from "undici";
import { normalizeData } from "../utils/normalization.js";
import { calculateAHP } from "./ahp.js";

const REQUEST_TYPE = "GET";
const API_URL = "https://api.elsevier.com";

let AUTH_TOKEN = null;

async function authenticate() {
    const apiKey = process.env.ELSEVIER_API_KEY;
    console.log("Authenticating with Elsevier...");

    const resp = await fetch(`${API_URL}/authenticate?choice=55137&platform=SCIDIR&apiKey=${apiKey}`, {
        method: REQUEST_TYPE,
        headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        }
    });

    if (resp.status !== 200) {
        throw new Error("Failed to get auth token: " + resp.status);
    }

    const res = await resp.json();
    AUTH_TOKEN = res["authenticate-response"].authtoken;
    return AUTH_TOKEN;
}

async function fetchPage(query, start, count, token) {
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

    if (resp.status !== 200) {
        let errBody = "";
        try { errBody = await resp.text(); } catch(e){}
        console.error("Elsevier API 400 Error Body:", errBody);
        throw new Error(`Error fetching page starting at ${start}: ${resp.status}`);
    }

    return await resp.json();
}

export async function searchLiterature(query, count, weights = null) {
    if (!AUTH_TOKEN) {
        await authenticate();
    }

    // Scopus API allows max 25 items per page for standard keys.
    const chunkSize = 25;
    
    // Initial fetch to get total results
    let rawListings = [];
    const firstPage = await fetchPage(query, 0, chunkSize, AUTH_TOKEN);

    const totalResults = parseInt(firstPage["search-results"]["opensearch:totalResults"]);
    const initialEntry = firstPage["search-results"].entry || [];
    rawListings.push(...initialEntry);

    console.log(`Total found: ${totalResults}. Requested: ${count}`);

    // Fetch more pages if needed
    const numItemsNeeded = Math.min(count, totalResults);
    const maxPages = Math.ceil(numItemsNeeded / chunkSize);

    for (let i = 1; i < maxPages; i++) {
        const start = i * chunkSize;

        try {
            const pageData = await fetchPage(query, start, chunkSize, AUTH_TOKEN);
            if (pageData["search-results"].entry) {
                rawListings.push(...pageData["search-results"].entry);
            }
        } catch (err) {
            console.error("Pagination error:", err);
            break; // Stop fetching more pages if one fails
        }
    }

    // Normalize Data
    console.log(`Normalizing ${rawListings.length} raw items...`);
    let cleanData = await normalizeData(rawListings, query);

    // Apply AHP
    console.log("Calculating AHP scores...");
    const rankedData = await calculateAHP(cleanData, weights);

    return {
        totalFound: totalResults,
        analyzedCount: rankedData.length,
        results: rankedData.slice(0, 100) // Return top 100
    };
}
