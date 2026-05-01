import mongoose from 'mongoose';

const CollectionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  papers: [{
    title: String,
    year: String,
    authors: String,
    url: String,
    doi: String,
    publicationName: String,
    citedBy: Number,
    description: String,
    savedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid duplicate collection names for the same user
CollectionSchema.index({ userId: 1, name: 1 }, { unique: true });

const Collection = mongoose.model('Collection', CollectionSchema);

export default Collection;
