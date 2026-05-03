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
    required: true,
    maxlength: 150
  },
  results: {
    type: Array,
    required: true,
    validate: [
      (arr) => Array.isArray(arr) && arr.length <= 100,
      'En fazla 100 sonuc paylasilabilir.'
    ]
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
