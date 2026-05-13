import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChunkEmbedding } from '../models/ChunkEmbedding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function getDimension() {
  await mongoose.connect(process.env.MONGODB_URI);
  const doc = await ChunkEmbedding.findOne();
  if (doc) {
    console.log("Dimension:", doc.embedding.length);
  } else {
    console.log("No docs found");
  }
  await mongoose.disconnect();
}
getDimension();
