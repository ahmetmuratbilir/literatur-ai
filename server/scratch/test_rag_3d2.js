import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding, searchSimilarChunksWithAtlas } from '../services/embeddingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTests() {
  if (!process.env.MONGODB_URI || !process.env.GEMINI_API_KEY) {
    console.error('MONGODB_URI veya GEMINI_API_KEY eksik.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Bağlandı.');

  const query = 'yapay zeka kanser teşhisi';
  console.log(`\nSorgu: "${query}"`);
  
  try {
    // Önce query'i vektöre çevir
    const queryEmbedding = await getEmbedding(query);
    console.log(`Query Vektör Boyutu: ${queryEmbedding.length}`);

    // Atlas Vector Search dene
    console.log('\nAtlas Vector Search sorgusu başlatılıyor...');
    const results = await searchSimilarChunksWithAtlas(queryEmbedding, 5);

    if (results.length > 0) {
      console.log('Atlas Sonuçları:');
      results.forEach(r => console.log(`[Score: ${r.semanticScore}] ${r.title}`));
    } else {
      console.log('Sonuç boş döndü (Index boş olabilir).');
    }
  } catch (e) {
    console.log('\nBeklenen Hata veya Index Yok:', e.message);
    console.log('Index bulunamadı, cosine fallback kullanılıyor mantığı devrede kalacak.');
  }

  await mongoose.disconnect();
}

runTests();
