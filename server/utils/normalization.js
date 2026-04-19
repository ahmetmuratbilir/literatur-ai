import pkg from 'natural';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

export async function normalizeData(rawData, queryContext) {
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

            // Extract Year
            const dateStr = item["prism:coverDate"] || item["prism:coverDisplayDate"] || "2000";
            normalized.year = parseInt(dateStr.slice(0, 4)) || 2000;

            // Handle Citations (citedby-count) if available, otherwise 0 (User warning: we removed random spawner)
            // But for AHP to work nicely, we might need some variance if the API doesn't return it.
            // The API response for metadata often contains 'citedby-count'. Let's check for it.
            normalized.citedBy = item['citedby-count'] ? parseInt(item['citedby-count']) : 0;

            // Keyword matching Logic
            // We count how many times the query keywords appear in the description
            let keyCount = 0;
            if (normalized.description) {
                const tokens = tokenizer.tokenize(normalized.description.toLowerCase());
                const queryTokens = tokenizer.tokenize(queryContext.toLowerCase());

                // Simple frequency count
                tokens.forEach(t => {
                    if (queryTokens.includes(t)) keyCount++;
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
