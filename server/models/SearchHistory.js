import mongoose from 'mongoose';

// Bir geçmiş kaydı: mainTopic(150) + authorName(80) + keywords(8 × 40) + aiQuery(300) ≈ 850 byte.
// Per user 100 kayıt × 850 byte ≈ 85KB.
const SearchHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    maxlength: 64
  },
  mainTopic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  authorName: {
    type: String,
    default: "",
    trim: true,
    maxlength: 80
  },
  keywords: {
    type: [{ type: String, trim: true, maxlength: 40 }],
    validate: [
      (arr) => Array.isArray(arr) && arr.length <= 8,
      'En fazla 8 anahtar kelime kaydedilebilir.'
    ]
  },
  aiQuery: {
    type: String,
    default: "",
    maxlength: 300
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index to help with duplicate detection
SearchHistorySchema.index({ userId: 1, mainTopic: 1, authorName: 1, keywords: 1 }, { background: true });

const SearchHistory = mongoose.model('SearchHistory', SearchHistorySchema);

export default SearchHistory;
