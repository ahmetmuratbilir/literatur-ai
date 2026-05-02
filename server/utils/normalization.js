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

const SUBTYPE_MAP = {
    'Article': 'Makale',
    'Review': 'Derleme',
    'Book Chapter': 'Kitap Bölümü',
    'Conference Paper': 'Konferans Bildirisi',
    'Editorial': 'Editöryal',
    'Errata': 'Hata Düzeltme',
    'Letter': 'Mektup',
    'Note': 'Not',
    'Short Survey': 'Kısa Rapor',
    'Book': 'Kitap',
    'Article in Press': 'Baskıdaki Makale'
};

export async function normalizeData(rawData, queryContext) {
    const ctx = String(queryContext ?? '');
    const cleaned = [];

    const getText = (obj) => {
        if (!obj) return "";
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => getText(item)).filter(Boolean).join(', ');
        }
        if (obj["$"]) return obj["$"];
        return "";
    };

const AGGREGATION_MAP = {
    'Journal': 'Akademik Dergi',
    'Book': 'Kitap',
    'Book Series': 'Kitap Serisi',
    'Conference Proceeding': 'Konferans Bildirisi',
    'Report': 'Rapor',
    'Encyclopedia': 'Ansiklopedi'
};

export async function normalizeData(rawData, queryContext) {
    const ctx = String(queryContext ?? '');
    const cleaned = [];

    const getText = (obj) => {
        if (!obj) return "";
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => getText(item)).filter(Boolean).join(', ');
        }
        if (obj["$"]) return obj["$"];
        return "";
    };

    for (const item of rawData) {
        try {
            const normalized = {};

            // Evrensel Başlık Kontrolü
            normalized.title = getText(item["dc:title"]) || item.title || item.display_name || "";
            if (!normalized.title) continue;

            // Evrensel Yazar Kontrolü (Fallback dahil)
            let creators = getText(item["dc:creator"]) || item.author || "";
            if (!creators && item.authorships) {
                creators = item.authorships.map(a => a.author?.display_name).filter(Boolean).join(', ');
            }
            normalized.creator = creators || "Bilinmeyen Yazar";
            
            // Evrensel Yayın Adı
            normalized.publicationName = getText(item["prism:publicationName"]) || item.publisher || item.host_venue?.display_name || item.container_title || "";
            
            // Evrensel Tarih
            const rawDate = getText(item["prism:coverDate"]) || item.publication_date || item.year || item.created || "2024";
            const yearMatch = String(rawDate).match(/\d{4}/);
            normalized.year = yearMatch ? parseInt(yearMatch[0], 10) : 2024;

            // Yayın Türü ve Kaynak Tipi
            const rawType = item.subtypeDescription || item.type || "";
            normalized.type = SUBTYPE_MAP[rawType] || rawType || "Makale";
            
            const rawAgg = item['prism:aggregationType'] || "";
            normalized.aggregationType = AGGREGATION_MAP[rawAgg] || rawAgg || "Dergi";

            // Açık Erişim Durumu
            normalized.openAccess = item.openaccessArticle === "1" || item.openaccess === true || !!item.is_oa;

            // ÖZET VE TEASER KURTARMA
            normalized.teaser = getText(item["prism:teaser"]) || "";
            let description = getText(item["dc:description"]) || item.abstract || item.snippet || "";
            if (!description && item.abstract_inverted_index) {
                description = reconstructAbstract(item.abstract_inverted_index);
            }
            normalized.description = description;

            // URL & DOI
            normalized.doi = item.doi || item.ids?.doi || item['prism:doi'] || "";
            
            let url = "";
            if (Array.isArray(item.link)) {
                const scopusLink = item.link.find(l => l['@ref'] === 'scopus' || l['@rel'] === 'scopus');
                if (scopusLink) url = scopusLink['@href'];
            }
            if (!url) {
                url = getText(item["prism:url"]) || item.url || item.id || "";
            }
            normalized.url = url.startsWith('http') ? url : (normalized.doi ? `https://doi.org/${normalized.doi.replace(/^https?:\/\/doi.org\//, '')}` : '');

            // Atıf Sayısı
            normalized.citedBy = parseInt(item['citedby-count'] || item.cited_by_count || item.citations_count || 0, 10);
            
            normalized.source = item.source || (item.eid ? 'Scopus' : 'Global Havuz');

            // AHP ve Alaka Skoru İçin Kelime Sayımı
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
            
            // Otomatik Alaka Skoru (0-100)
            const keywordString = getText(item.authkeywords) || "";
            const keywords = keywordString.split('|').map(k => k.trim().toLowerCase());
            let matchCount = 0;
            queryTokens.forEach(qt => {
                if (keywords.some(kw => kw.includes(qt))) matchCount++;
            });
            normalized.relevanceScore = keywords.length > 0 ? Math.min(100, Math.round((matchCount / keywords.length) * 100)) : 0;

            cleaned.push(normalized);

        } catch (e) {
            console.warn("Normalize Hatası (Öğe Atlanıyor):", e.message);
        }
    }

    return cleaned;
}
