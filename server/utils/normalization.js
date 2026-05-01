import pkg from 'natural';
const { WordTokenizer } = pkg;
const tokenizer = new WordTokenizer();

/**
 * OpenAlex inverted index özetlerini düz metne çevirir
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  try {
    const entries = Object.entries(invertedIndex);
    const words = [];
    entries.forEach(([word, positions]) => {
      positions.forEach(pos => {
        words[pos] = word;
      });
    });
    return words.join(' ');
  } catch (e) {
    return "";
  }
}

export async function normalizeData(rawData, queryContext) {
    const ctx = String(queryContext ?? '');
    const cleaned = [];

    const getText = (obj) => {
        if (!obj) return "";
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj) && obj.length > 0) return getText(obj[0]);
        if (obj["$"]) return obj["$"];
        return "";
    };

    for (const item of rawData) {
        try {
            const normalized = {};

            // Evrensel Başlık Kontrolü
            normalized.title = getText(item["dc:title"]) || item.title || item.display_name || "";
            if (!normalized.title) continue;

            // Evrensel Yazar Kontrolü
            normalized.creator = getText(item["dc:creator"]) || item.author || (item.authorships ? item.authorships.map(a => a.author?.display_name).join(', ') : "") || "Bilinmeyen Yazar";
            
            // Evrensel Yayın Adı
            normalized.publicationName = getText(item["prism:publicationName"]) || item.publisher || item.host_venue?.display_name || item.container_title || "";
            
            // Evrensel Tarih
            const rawDate = getText(item["prism:coverDate"]) || item.publication_date || item.year || item.created || "2024";
            normalized.year = parseInt(String(rawDate).slice(0, 4), 10) || 2024;

            // ÖZET KURTARMA (Kritik Nokta)
            let description = getText(item["dc:description"]) || item.abstract || item.snippet || "";
            if (!description && item.abstract_inverted_index) {
                description = reconstructAbstract(item.abstract_inverted_index);
            }
            normalized.description = description;

            // URL & DOI
            normalized.doi = item.doi || item.ids?.doi || "";
            const rawUrl = getText(item["prism:url"]) || item.url || item.id || "";
            normalized.url = rawUrl.startsWith('http') ? rawUrl : (normalized.doi ? `https://doi.org/${normalized.doi.replace(/^https?:\/\/doi.org\//, '')}` : '');

            // Atıf Sayısı
            normalized.citedBy = parseInt(item['citedby-count'] || item.cited_by_count || item.citations_count || 0, 10);
            
            normalized.source = item.source || (item.eid ? 'Scopus' : 'Global Havuz');

            // AHP Skorlama İçin Kelime Sayımı
            let keyCount = 0;
            const queryTokens = tokenizer.tokenize(ctx.toLowerCase());

            if (normalized.title) {
                const titleTokens = tokenizer.tokenize(normalized.title.toLowerCase());
                titleTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 3; });
            }

            if (normalized.description) {
                const descTokens = tokenizer.tokenize(normalized.description.toLowerCase());
                descTokens.forEach(t => { if (queryTokens.includes(t)) keyCount += 1; });
            }
            
            normalized.keyCount = keyCount;
            cleaned.push(normalized);

        } catch (e) {
            console.warn("Normalize Hatası (Öğe Atlanıyor):", e.message);
        }
    }

    return cleaned;
}
