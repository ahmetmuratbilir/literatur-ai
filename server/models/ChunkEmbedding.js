import mongoose from 'mongoose';

const chunkEmbeddingSchema = new mongoose.Schema({
  articleId: { type: String }, // Opsiyonel
  sourceIndex: { type: String, required: true },
  title: { type: String },
  year: { type: String },
  chunkText: { type: String, required: true },
  embedding: { type: [Number], required: true },
  embeddingModel: { type: String, default: 'gemini-embedding-001' },
  contentHash: { type: String, required: true, unique: true }, // Cache kontrolü için
  createdAt: { type: Date, default: Date.now } // Şimdilik süre kısıtı yok
});

export const ChunkEmbedding = mongoose.model('ChunkEmbedding', chunkEmbeddingSchema);
