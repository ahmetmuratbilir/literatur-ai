import mongoose from 'mongoose';

// Bir analiz: topic(150) + explanation(500) + 5 × (query.text(180) + score) ≈ 1.6KB.
// Per user 100 analiz × 1.6KB ≈ 160KB.
const AnalysisSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true, maxlength: 64 },
  topic: { type: String, required: true, maxlength: 150 },
  explanation: { type: String, maxlength: 500 },
  queries: {
    type: [{
      text: { type: String, maxlength: 180 },
      relevanceScore: { type: Number, min: 0, max: 100 }
    }],
    validate: [
      (arr) => Array.isArray(arr) && arr.length <= 10,
      'En fazla 10 sorgu kaydedilebilir.'
    ]
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

export default mongoose.model('Analysis', AnalysisSchema);
