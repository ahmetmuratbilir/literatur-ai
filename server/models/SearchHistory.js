import mongoose from 'mongoose';

const SearchHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  mainTopic: {
    type: String,
    required: true,
    trim: true
  },
  authorName: {
    type: String,
    default: "",
    trim: true
  },
  keywords: [{
    type: String,
    trim: true
  }],
  aiQuery: {
    type: String,
    default: ""
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
