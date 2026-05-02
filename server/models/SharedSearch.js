import mongoose from 'mongoose';

const SharedSearchSchema = new mongoose.Schema({
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  mainTopic: {
    type: String,
    required: true
  },
  results: {
    type: Array,
    required: true
  },
  aiAnalysis: {
    type: Object,
    default: null
  },
  originalParams: {
    type: Object,
    default: {}
  },
  viewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // 30 gün sonra otomatik silinsin (opsiyonel, kalıcı da olabilir)
  }
});

const SharedSearch = mongoose.model('SharedSearch', SharedSearchSchema);

export default SharedSearch;
