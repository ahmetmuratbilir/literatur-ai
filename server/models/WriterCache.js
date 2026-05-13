import mongoose from 'mongoose';

const WriterCacheSchema = new mongoose.Schema({
  requestHash: { type: String, required: true, unique: true },
  generatedText: { type: String, required: true },
  prompt: { type: String },
  papersCount: { type: Number },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // 1 saat sonra silinsin (Kısa süreli cache)
});

export const WriterCache = mongoose.model('WriterCache', WriterCacheSchema);
