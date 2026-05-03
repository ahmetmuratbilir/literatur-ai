import mongoose from 'mongoose';

const searchCacheSchema = new mongoose.Schema({
  // Legacy unique field kept as the canonical cache key so existing Mongo indexes stay valid.
  query: { type: String, required: true, unique: true, index: true },
  cacheKey: { type: String },
  displayQuery: { type: String, default: '', maxlength: 600 },
  normalizedParams: { type: Object, default: {} },
  data: { type: Object, required: true },
  resultCount: { type: Number, default: 0 },
  totalFound: { type: Number, default: 0 },
  analyzedCount: { type: Number, default: 0 },
  sourceBreakdown: { type: Object, default: {} },
  totalFromAPIs: { type: Object, default: {} },
  byteSize: { type: Number, default: 0, index: true },
  searchCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
  lastHitAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true }
});

searchCacheSchema.index({ cacheKey: 1 }, { unique: true, sparse: true, background: true });
searchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });

export default mongoose.model('SearchCache', searchCacheSchema);
