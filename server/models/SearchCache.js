import mongoose from 'mongoose';

const searchCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, unique: true, index: true },
  results: { type: Array, required: true },
  totalFound: { type: Number, default: 0 },
  analyzedCount: { type: Number, default: 0 },
  sourceBreakdown: { type: Object, default: {} },
  totalFromAPIs: { type: Object, default: {} },
  searchCount: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now, expires: 2592000 } // 30 gün (30 * 24 * 60 * 60)
});

export default mongoose.model('SearchCache', searchCacheSchema);
