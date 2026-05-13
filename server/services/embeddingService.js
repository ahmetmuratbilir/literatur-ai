import { GoogleGenerativeAI } from '@google/generative-ai';


import crypto from 'crypto';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

function createHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 2 vektör arasındaki Cosine Similarity skoru
 */
export function cosineSimilarity(vecA, vecB) {
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
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
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
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  
  // Fazla maliyet/limit riski için sadece ilk 20'yi alıyoruz
  const safeChunks = chunks.slice(0, 20);
  const resultChunks = [];
  const chunksToEmbed = [];

  let cacheHits = 0;
  let cacheMisses = 0;

  // 1. Cache kontrolü için hash üret ve DB'de ara
  for (let chunk of safeChunks) {
    const textToEmbed = (chunk.title || '') + '\n' + (chunk.chunkText || '');
    const hash = createHash(textToEmbed);
    chunk.contentHash = hash;
    chunk.textToEmbed = textToEmbed;

    try {
      // mongoose yüklü ve db bağlı varsayıyoruz
      const cached = await ChunkEmbedding.findOne({ contentHash: hash });
      if (cached && cached.embedding && cached.embedding.length > 0) {
        chunk.embedding = cached.embedding;
        resultChunks.push(chunk);
        cacheHits++;
      } else {
        chunksToEmbed.push(chunk);
      }
    } catch (e) {
      console.warn('[CACHE] MongoDB okuma hatası:', e.message);
      chunksToEmbed.push(chunk);
    }
  }

  // 2. Eksik olanlar (Miss) için API çağrısı yap
  if (chunksToEmbed.length > 0) {
    cacheMisses = chunksToEmbed.length;
    const requests = chunksToEmbed.map(c => ({
      content: { parts: [{ text: c.textToEmbed }] }
    }));
    
    const apiResult = await model.batchEmbedContents({ requests });
    
    // 3. API'den gelenleri kaydet ve sonuca ekle
    for (let i = 0; i < chunksToEmbed.length; i++) {
      const chunk = chunksToEmbed[i];
      chunk.embedding = apiResult.embeddings[i].values;
      resultChunks.push(chunk);

      try {
        await ChunkEmbedding.create({
          sourceIndex: String(chunk.sourceIndex || '0'),
          title: chunk.title || 'Bilinmiyor',
          year: String(chunk.year || '0'),
          chunkText: chunk.chunkText,
          embedding: chunk.embedding,
          embeddingModel: 'gemini-embedding-001',
          contentHash: chunk.contentHash
        });
      } catch (dbErr) {
        if (dbErr.code !== 11000) { // 11000 duplicate key (zaten var hatası)
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
 */
export async function searchSimilarChunksWithAtlas(queryEmbedding, limit = 12) {
  try {
    const results = await ChunkEmbedding.aggregate([
      {
        $vectorSearch: {
          index: "chunk_embedding_vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: limit * 5,
          limit: limit
        }
      },
      {
        $project: {
          _id: 0,
          sourceIndex: 1,
          title: 1,
          year: 1,
          chunkText: 1,
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
