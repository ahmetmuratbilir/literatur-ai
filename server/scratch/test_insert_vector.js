import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding } from '../services/embeddingService.js';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function insertTestDocs() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const text = 'Yapay zeka modelleri kanser teşhisinde yüksek başarı göstermektedir.';
  const embedding = await getEmbedding(text);
  
  await ChunkEmbedding.create({
    sourceIndex: '999',
    title: 'Yapay Zeka ve Kanser',
    year: '2025',
    chunkText: text,
    embedding: embedding,
    embeddingModel: 'gemini-embedding-001',
    contentHash: 'dummy_hash_for_test_' + Date.now()
  });
  
  console.log('Test dokümanı eklendi!');
  await mongoose.disconnect();
}
insertTestDocs();
