import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding, searchSimilarChunksWithAtlas } from '../services/embeddingService.js';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const sampleDocs = [
  { title: 'Onkolojik Teşhis ve Gelişmiş Algoritmalar', chunkText: 'Kanser teşhisi sırasında veri bilimi çok etkilidir.' },
  { title: 'Yapay Zeka ve Tanı Süreçleri', chunkText: 'AI algoritmaları doktorların teşhislerine yardımcı olur.' },
  { title: 'Üniversite Kampüslerinde Ulaşım', chunkText: 'Öğrenciler otobüs seferlerinden şikayetçidir.' }
];

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Bağlandı.\n');

  // Insert test docs if they don't exist
  for (let i = 0; i < sampleDocs.length; i++) {
    const doc = sampleDocs[i];
    const exists = await ChunkEmbedding.findOne({ title: doc.title });
    if (!exists) {
      console.log(`Eksik doküman ekleniyor: ${doc.title}`);
      const embedding = await getEmbedding(doc.title + ' ' + doc.chunkText);
      await ChunkEmbedding.create({
        sourceIndex: String(i),
        title: doc.title,
        year: '2025',
        chunkText: doc.chunkText,
        embedding: embedding,
        embeddingModel: 'gemini-embedding-001',
        contentHash: 'test_hash_' + Date.now() + '_' + i
      });
    }
  }

  // Biraz bekleyelim index güncellensin (Atlas 1-2 saniye sürebilir)
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('--- TEST: "kanser tanısı" ---');
  const query1 = 'kanser tanısı';
  const queryEmbedding1 = await getEmbedding(query1);
  const results1 = await searchSimilarChunksWithAtlas(queryEmbedding1, 5);
  results1.forEach(r => console.log(`[Score: ${r.semanticScore?.toFixed(4)}] ${r.title}`));

  console.log('\n--- TEST: "onkolojik teşhis" ---');
  const query2 = 'onkolojik teşhis';
  const queryEmbedding2 = await getEmbedding(query2);
  const results2 = await searchSimilarChunksWithAtlas(queryEmbedding2, 5);
  results2.forEach(r => console.log(`[Score: ${r.semanticScore?.toFixed(4)}] ${r.title}`));

  await mongoose.disconnect();
}

runTests();
