import mongoose from 'mongoose';

const AnalysisSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  topic: { type: String, required: true },
  explanation: { type: String },
  queries: [{
    text: String,
    relevanceScore: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Analysis', AnalysisSchema);
