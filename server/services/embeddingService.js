import { GoogleGenerativeAI } from '@google/generative-ai';


import crypto from 'crypto';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

// Cache anahtarinin parcasi: farkli model farkli vektor boyutu uretir.
const EMBEDDING_MODEL = 'gemini-embedding-001';

function createHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 2 vektör arasındaki Cosine Similarity skoru
 */
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;

  // Boyut uyuşmazlığı sessizce NaN üretirdi: döngü vecA.length üzerinden
  // dönüp vecB'den undefined okuyordu. NaN hata fırlatmaz ama sort()
  // karşılaştırıcısını bozarak sıralamayı rastgeleleştirir.
  if (vecA.length !== vecB.length) {
    console.warn(
      `[EMBEDDING] Vektör boyutları uyuşmuyor (${vecA.length} vs ${vecB.length}); benzerlik 0 kabul edildi.`
    );
    return 0;
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Tek bir metin için Gemini üzerinden embedding döner.
 * (Prompt için cache kullanmıyoruz, çok kısa ve dinamik)
 */
export async function getEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'FAKE_API_KEY_FOR_TESTING') {
    throw new Error('GEMINI_API_KEY bulunamadı veya geçersiz.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Gemini gemini-embedding-001
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Chunk dizisine toplu olarak embedding ekler.
 * Faz 3D-1: MongoDB Caching
 */
export async function getEmbeddingsForChunks(chunks) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'FAKE_API_KEY_FOR_TESTING') {
    throw new Error('GEMINI_API_KEY bulunamadı veya geçersiz.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  // Fazla maliyet/limit riski için sadece ilk 20'yi alıyoruz
  const safeChunks = chunks.slice(0, 20);
  const resultChunks = [];
  const chunksToEmbed = [];

  for (const chunk of safeChunks) {
    const textToEmbed = (chunk.title || '') + '\n' + (chunk.chunkText || '');
    chunk.contentHash = createHash(textToEmbed);
    chunk.textToEmbed = textToEmbed;
  }

  // 1. Cache kontrolü: tek sorgu.
  //
  // Önceki sürüm chunk başına ayrı findOne çağırıyordu — 20 chunk için 20 ardışık
  // Atlas gidiş-dönüşü. Ayrıca yalnızca contentHash ile sorguluyordu; embedding
  // modeli değiştiğinde farklı boyuttaki eski vektörler cache'ten servis edilip
  // cosineSimilarity'yi NaN üretmeye zorluyordu. Model artık sorgunun parçası.
  const cacheByHash = new Map();
  try {
    const hashes = safeChunks.map((chunk) => chunk.contentHash);
    const cachedDocs = await ChunkEmbedding.find({
      contentHash: { $in: hashes },
      embeddingModel: EMBEDDING_MODEL,
    }).lean();

    for (const doc of cachedDocs) {
      if (doc.embedding && doc.embedding.length > 0) {
        cacheByHash.set(doc.contentHash, doc.embedding);
      }
    }
  } catch (e) {
    console.warn('[CACHE] MongoDB okuma hatası:', e.message);
  }

  for (const chunk of safeChunks) {
    const cached = cacheByHash.get(chunk.contentHash);
    if (cached) {
      chunk.embedding = cached;
      resultChunks.push(chunk);
    } else {
      chunksToEmbed.push(chunk);
    }
  }

  const cacheHits = resultChunks.length;
  const cacheMisses = chunksToEmbed.length;

  // 2. Eksik olanlar (Miss) için API çağrısı yap
  if (chunksToEmbed.length > 0) {
    const requests = chunksToEmbed.map(c => ({
      content: { parts: [{ text: c.textToEmbed }] }
    }));

    const apiResult = await model.batchEmbedContents({ requests });
    const embeddings = apiResult?.embeddings;

    // İndeks hizalaması varsayımı doğrulanmadan kullanılıyordu; API eksik
    // dönerse `embeddings[i].values` TypeError fırlatır.
    if (!Array.isArray(embeddings) || embeddings.length !== chunksToEmbed.length) {
      throw new Error(
        `Embedding API ${chunksToEmbed.length} vektör beklenirken ${embeddings?.length ?? 0} döndü.`
      );
    }

    const documentsToCache = [];

    for (let i = 0; i < chunksToEmbed.length; i++) {
      const chunk = chunksToEmbed[i];
      const values = embeddings[i]?.values;
      if (!Array.isArray(values) || values.length === 0) {
        console.warn(`[EMBEDDING] ${i}. vektör boş döndü, chunk atlandı.`);
        continue;
      }

      chunk.embedding = values;
      resultChunks.push(chunk);

      documentsToCache.push({
        sourceIndex: String(chunk.sourceIndex || '0'),
        title: chunk.title || 'Bilinmiyor',
        authors: chunk.authors || 'Bilinmiyor',
        year: String(chunk.year || '0'),
        chunkText: chunk.chunkText,
        embedding: chunk.embedding,
        embeddingModel: EMBEDDING_MODEL,
        contentHash: chunk.contentHash,
      });
    }

    // 3. Tek yazma. Önceki sürüm chunk başına ayrı create() bekliyordu.
    // ordered:false sayesinde tek bir duplicate-key hatası kalanları engellemez.
    if (documentsToCache.length > 0) {
      try {
        await ChunkEmbedding.insertMany(documentsToCache, { ordered: false });
      } catch (dbErr) {
        const onlyDuplicates =
          dbErr.code === 11000 ||
          (Array.isArray(dbErr.writeErrors) && dbErr.writeErrors.every((e) => e.code === 11000));
        if (!onlyDuplicates) {
          console.warn('[CACHE] MongoDB yazma hatası:', dbErr.message);
        }
      }
    }
  }

  console.log(`[CACHE] Hit: ${cacheHits} | Miss: ${cacheMisses}`);
  return resultChunks;
}

/**
 * MongoDB Atlas Vector Search kullanarak benzer chunkları bulur.
 * Faz 3D-2: Index hazırlığı ve sorgu testi.
 *
 * ÖNEMLİ: ChunkEmbedding koleksiyonu tüm kullanıcılar için ortak bir cache'tir.
 * allowedContentHashes verilmezse sorgu tüm koleksiyona açılır ve başka
 * kullanıcıların makale içerikleri sonuca karışır. Bu yüzden filtre zorunludur.
 *
 * @param {number[]} queryEmbedding - Sorgu vektörü
 * @param {number} limit - Dönecek chunk sayısı
 * @param {string[]} allowedContentHashes - Yalnızca bu hash'lere sahip chunk'lar aranır
 */
export async function searchSimilarChunksWithAtlas(queryEmbedding, limit = 12, allowedContentHashes) {
  if (!Array.isArray(allowedContentHashes) || allowedContentHashes.length === 0) {
    throw new Error(
      'Atlas Vector Search kapsam filtresi olmadan çağrılamaz (allowedContentHashes boş).'
    );
  }

  try {
    const results = await ChunkEmbedding.aggregate([
      {
        $vectorSearch: {
          index: "chunk_embedding_vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          filter: { contentHash: { $in: allowedContentHashes } },
          numCandidates: Math.max(limit * 5, allowedContentHashes.length),
          limit: limit
        }
      },
      {
        $project: {
          _id: 0,
          sourceIndex: 1,
          title: 1,
          authors: 1,
          year: 1,
          chunkText: 1,
          contentHash: 1,
          semanticScore: { $meta: "vectorSearchScore" }
        }
      }
    ]);
    return results;
  } catch (error) {
    console.warn('[RETRIEVAL] Atlas Index hatası:', error.message);
    throw error;
  }
}

/**
 * Chunkları embedding benzerliğine göre sıralar.
 */
export async function rankChunksByEmbedding(chunks, userPrompt, maxChunks = 12) {
  try {
    const promptEmbedding = await getEmbedding(userPrompt);
    const chunksWithEmbeddings = await getEmbeddingsForChunks(chunks);
    
    const scoredChunks = chunksWithEmbeddings.map(chunk => {
      const score = cosineSimilarity(promptEmbedding, chunk.embedding);
      return { ...chunk, semanticScore: score };
    });
    
    // Yüksek semantic skordan küçüğe sırala
    scoredChunks.sort((a, b) => b.semanticScore - a.semanticScore);
    return scoredChunks.slice(0, maxChunks);
  } catch (error) {
    console.error('[EMBEDDING] Vektör sıralama hatası:', error.message);
    throw error; // Yakalanıp keyword fallback yapılacak
  }
}
