import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { rankChunksByEmbedding } from '../services/embeddingService.js';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const testChunks = [
  { sourceIndex: '100', title: 'Yapay Zeka Cache Testi 1', chunkText: 'Bu birinci cache test metnidir.' },
  { sourceIndex: '101', title: 'Yapay Zeka Cache Testi 2', chunkText: 'Bu da ikinci cache test metnidir.' }
];

async function runTests() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI bulunamadı!');
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY bulunamadı!');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Bağlandı.');

  // Temizlik (aynı test tekrar çalışırsa diye)
  await ChunkEmbedding.deleteMany({ title: { $regex: 'Cache Testi' } });

  console.log('\n--- 1. Çalıştırma (Cache MISS Bekleniyor) ---');
  await rankChunksByEmbedding(testChunks, 'test');

  console.log('\n--- 2. Çalıştırma (Cache HIT Bekleniyor) ---');
  await rankChunksByEmbedding(testChunks, 'test');

  await mongoose.disconnect();
}

runTests();
