/**
 * RAG Service - Faz 3A: Chunking Altyapısı
 * Şimdilik embedding ve Vektör DB olmadan, sadece veriyi normalize etme
 * ve düzenli metin parçalarına (chunk) bölme işlemlerini içerir.
 */

/**
 * Gelen makaleyi standart bir formata sokar.
 */
export function normalizeArticle(article) {
  return {
    ref: article.ref,
    title: article.title || 'Başlıksız',
    authors: article.authors || 'Bilinmiyor',
    year: article.year || 'n.d.',
    journal: article.journal || 'Bilinmeyen Kaynak',
    abstract: article.abstract ? article.abstract.trim() : ''
  };
}

/**
 * Makale listesinden, LLM'e gönderilmek üzere ufak parçalar (chunks) üretir.
 */
export function createChunksFromArticles(articles) {
  const chunks = [];
  
  articles.forEach(article => {
    const norm = normalizeArticle(article);
    if (!norm.abstract) return; // Abstract yoksa atla

    // Şimdilik çok basit bir chunking: Cümleleri noktadan bölüp 2'şerli gruplara ayırıyoruz.
    // İleride LangChain'in RecursiveCharacterTextSplitter'ı kullanılabilir.
    const sentences = norm.abstract.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sentences.length; i += 2) {
      const chunkText = sentences.slice(i, i + 2).join(' ');
      chunks.push({
        sourceIndex: norm.ref,
        title: norm.title,
        year: norm.year,
        authors: norm.authors,
        chunkText: chunkText
      });
    }
  });

  return chunks;
}

const STOPWORDS = new Set([
  've', 'veya', 'ile', 'için', 'bu', 'şu', 'o', 'bir', 'the', 'and', 'of', 'in', 'on', 'to', 'for', 'with', 
  'a', 'an', 'is', 'are', 'was', 'were', 'it', 'as', 'by', 'at', 'from', 'but', 'not', 'or', 'be', 'are',
  'da', 'de', 'ki', 'mı', 'mi', 'mu', 'mü', 'gibi', 'kadar', 'çok', 'daha', 'en', 'göre', 'olan', 'olarak'
]);

/**
 * Basit metin temizleme ve kelime çıkarma
 */
function extractKeywords(text) {
  if (!text) return [];
  const words = text.toLowerCase().replace(/[^\w\sğüşıöç]/g, ' ').split(/\s+/);
  return words.filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function getPhrases(keywords) {
  const phrases = [];
  for (let i = 0; i < keywords.length - 1; i++) {
    phrases.push(`${keywords[i]} ${keywords[i + 1]}`);
  }
  return phrases;
}

/**
 * Kullanıcı yönlendirmesine (prompt) göre chunkları hybrid keyword eşleşmesiyle skorlar.
 * @param {Array} chunks - createChunksFromArticles çıktısı
 * @param {string} userPrompt - Kullanıcının yazdığı konu/prompt
 * @param {number} maxChunks - Döndürülecek maksimum chunk sayısı
 * @param {object} options - Hybrid scoring ayarları
 */
export function scoreChunksByKeywords(chunks, userPrompt, maxChunks = 12, options = {}) {
  const {
    maxChunksPerArticle = 3,
    titleWeight = 3,
    phraseWeight = 4,
    textWeight = 1
  } = options;

  const keywords = extractKeywords(userPrompt);
  const phrases = getPhrases(keywords);
  
  // Eğer keyword bulunamadıysa, ilk N chunk'ı dön
  if (keywords.length === 0) {
    return chunks.slice(0, maxChunks);
  }

  const currentYear = new Date().getFullYear();

  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    const titleText = (chunk.title || '').toLowerCase();
    const chunkBodyText = (chunk.chunkText || '').toLowerCase();
    
    // 1. Text (Abstract/Body) Match
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = chunkBodyText.match(regex);
      if (matches) score += (matches.length * textWeight);
    });

    // 2. Title Match
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = titleText.match(regex);
      if (matches) score += (matches.length * titleWeight);
    });

    // 3. Phrase Match
    phrases.forEach(phrase => {
      if (chunkBodyText.includes(phrase)) score += phraseWeight;
      if (titleText.includes(phrase)) score += (phraseWeight * titleWeight);
    });

    // 4. Year Decay (Çok eski makalelere ufak bir eksi puan, veya yenilere artı)
    // 2024'ten ne kadar eskiyse o kadar -0.1 puan (Eğer yıl verisi varsa)
    const year = parseInt(chunk.year);
    if (!isNaN(year) && year > 1900) {
      const age = Math.max(0, currentYear - year);
      score -= (age * 0.1); 
    }

    return { ...chunk, score };
  });

  // Skora göre büyükten küçüğe sırala
  scoredChunks.sort((a, b) => b.score - a.score);

  // Eğer en iyi skor 0 veya daha düşükse (alakasızsa), eski düzende dön
  if (scoredChunks.length > 0 && scoredChunks[0].score <= 0) {
    return chunks.slice(0, maxChunks);
  }

  // 5. Max Chunks Per Article Filtresi
  const finalChunks = [];
  const articleCounts = {};

  for (const chunk of scoredChunks) {
    if (finalChunks.length >= maxChunks) break;
    // Sadece skoru 0'dan büyük olanları (anlamlı olanları) dahil edelim
    if (chunk.score <= 0) continue;

    const sourceId = chunk.sourceIndex;
    if (!articleCounts[sourceId]) articleCounts[sourceId] = 0;

    if (articleCounts[sourceId] < maxChunksPerArticle) {
      finalChunks.push(chunk);
      articleCounts[sourceId]++;
    }
  }

  return finalChunks.length > 0 ? finalChunks : chunks.slice(0, maxChunks);
}

/**
 * Üretilen chunkları LLM'e gönderilecek "Context" metnine dönüştürür.
 * @param {Array} chunks - scoreChunksByKeywords çıktısı
 * @param {number} maxChunks - Gönderilecek maksimum chunk sayısı (şimdilik sıralı alıyor)
 */
export function buildContextFromChunks(chunks, maxChunks = 40) {
  const selectedChunks = chunks.slice(0, maxChunks);
  
  // LLM'in okuyacağı şekilde string olarak birleştir
  return selectedChunks.map(c => 
    `[Kaynak ${c.sourceIndex}] ${c.authors} (${c.year}). "${c.title}".\nMetin: ${c.chunkText}`
  ).join('\n\n---\n\n');
}
