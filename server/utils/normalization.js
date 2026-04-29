import pkg from 'natural';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

export async function normalizeData(rawData, queryContext) {
    const ctx = String(queryContext ?? '');
    const cleaned = [];

    // Helper to get text from nested structure
    const getText = (obj) => {
        if (!obj) return "";
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj) && obj.length > 0) return getText(obj[0]);
        if (obj["$"]) return obj["$"];
        return "";
    };

    for (const item of rawData) {
        try {
            // Skip if critical fields are missing
            if (!item["dc:title"]) continue;

            const normalized = {};

            normalized.id = item.eid || Math.random().toString(36);
            normalized.title = getText(item["dc:title"]);
            normalized.creator = getText(item["dc:creator"]);
            normalized.publicationName = getText(item["prism:publicationName"]);
            normalized.coverDate = getText(item["prism:coverDate"]);
            normalized.description = getText(item["dc:description"]);
            normalized.source = 'Scopus';

            // URL: prefer prism:url or dc:identifier DOI link
            const rawUrl = getText(item["prism:url"]) || getText(item["dc:identifier"]) || '';
            normalized.url = rawUrl.startsWith('http') ? rawUrl : (rawUrl ? `https://doi.org/${rawUrl.replace(/^DOI:/i, '').trim()}` : '');

            // Extract Year — guard against short/null strings
            const dateStr = String(item["prism:coverDate"] || item["prism:coverDisplayDate"] || '2000');
            normalized.year = parseInt(dateStr.slice(0, 4), 10) || 2000;

            // Handle Citations (citedby-count) if available, otherwise 0
            normalized.citedBy = item['citedby-count'] ? parseInt(item['citedby-count'], 10) : 0;

            // Keyword matching Logic (AHP Relevance Score)
            let keyCount = 0;
            const queryTokens = tokenizer.tokenize(ctx.toLowerCase());

            // 1. Check Title (High Weight)
            if (normalized.title) {
                const titleTokens = tokenizer.tokenize(normalized.title.toLowerCase());
                titleTokens.forEach(t => {
                    if (queryTokens.includes(t)) keyCount += 3;
                });
            }

            // 2. Check Abstract (Normal Weight)
            if (normalized.description) {
                const descTokens = tokenizer.tokenize(normalized.description.toLowerCase());
                descTokens.forEach(t => {
                    if (queryTokens.includes(t)) keyCount += 1;
                });
            }
            normalized.keyCount = keyCount;

            cleaned.push(normalized);

        } catch (e) {
            console.warn("Skipping item due to error", e.message);
        }
    }

    return cleaned;
}
