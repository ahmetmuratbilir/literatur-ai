import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkIndex() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const count = await ChunkEmbedding.countDocuments();
  console.log('Kayıt Sayısı:', count);
  
  if (count > 0) {
    const doc = await ChunkEmbedding.findOne();
    console.log('Örnek Belge Başlığı:', doc.title);
    console.log('Embedding Boyutu:', doc.embedding.length);
  }
  
  await mongoose.disconnect();
}
checkIndex();
