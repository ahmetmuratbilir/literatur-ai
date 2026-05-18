import pkg from 'natural';
import { normalizePublicationDate } from './dateNormalization.js';
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

const AGGREGATION_MAP = {
    'Journal': 'Akademik Dergi',
    'Book': 'Kitap',
    'Book Series': 'Kitap Serisi',
    'Conference Proceeding': 'Konferans Bildirisi',
    'Report': 'Rapor',
    'Encyclopedia': 'Ansiklopedi'
};

function logDateNormalization(sourceName, dateMetadata) {
    const sourceField = dateMetadata.dateSource
        ? dateMetadata.dateSource.replace(`${sourceName} `, '')
        : 'unknown';
    const selectedYear = dateMetadata.publicationYear ?? dateMetadata.metadataYear ?? null;
    const confidenceText = dateMetadata.publicationYear
        ? dateMetadata.yearConfidence
        : `${dateMetadata.yearConfidence}${dateMetadata.metadataYear ? ' metadata only' : ''}`;
    console.log(`[DATE] ${sourceName} → ${sourceField} → ${selectedYear ?? 'null'} (${confidenceText})`);
}

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

            // Yıl ve Tarih
            const dateMetadata = normalizePublicationDate(item, 'Scopus');
            logDateNormalization('Scopus', dateMetadata);
            Object.assign(normalized, dateMetadata);
            normalized.coverDate = dateMetadata.publicationDate || null;
            normalized.year = dateMetadata.publicationYear ?? null;

            // DOI
            normalized.doi = item["prism:doi"] || item.doi || (item.external_ids?.doi) || "";

            // URL/Link
            normalized.url = (item.link && item.link[0] && item.link[0]["@href"]) || 
                            item.url || 
                            item.landing_page_url || 
                            (item.ids?.url) || "";

            // Kaynak Adı
            normalized.publicationName = getText(item["prism:publicationName"]) || 
                                       (item.host_venue?.display_name) || 
                                       (item.container_title) || "";

            // Yazarlar
            const creator = getText(item["dc:creator"]) || item.author_names?.join(', ') || "";
            const authors = Array.isArray(item.authors) ? item.authors.map(a => a.name || a.display_name).join(', ') : "";
            normalized.authors = creator || authors || "Bilinmeyen Yazar";

            // Atıf Sayısı
            normalized.citedBy = parseInt(item["citedby-count"] || item.cited_by_count || item.citations_count || 0);

            // Özet (Teaser)
            let abstract = item.description || item["dc:description"] || item.abstract || "";
            if (!abstract && item.abstract_inverted_index) {
                abstract = reconstructAbstract(item.abstract_inverted_index);
            }
            normalized.description = abstract ? abstract.slice(0, 500) : "";

            // Yayın Tipi
            const subType = item["subtypeDescription"] || item.type || "";
            normalized.pubTypeLabel = SUBTYPE_MAP[subType] || subType || "Makale";

            // Kaynak Tipi
            const aggregationType = item["prism:aggregationType"] || item.host_venue?.type || "";
            normalized.sourceTypeLabel = AGGREGATION_MAP[aggregationType] || aggregationType || "Akademik Dergi";

            // Alaka Skoru Hesaplama (Basit)
            const titleTokens = tokenizer.tokenize(normalized.title.toLowerCase());
            const ctxTokens = tokenizer.tokenize(ctx.toLowerCase());
            const matchCount = titleTokens.filter(t => ctxTokens.includes(t)).length;
            normalized.relevance = matchCount / Math.max(1, titleTokens.length);

            cleaned.push(normalized);
        } catch (err) {
            console.warn("Normalize hatası (atlandı):", err.message);
        }
    }

    return cleaned;
}
