import mongoose from 'mongoose';

// KB-minimization: tüm string alanlarda hard maxlength uygulanıyor.
// Bir paper kabaca: title(200) + authors(100) + publication(100) + url(200) + doi(80) + description(150) ≈ 850 char ≤ 1KB.
// Per collection 100 paper × 1KB ≈ 100KB üst sınır.
const PaperSchema = new mongoose.Schema({
  title: { type: String, maxlength: 200 },
  year: { type: String, maxlength: 8 },
  authors: { type: String, maxlength: 100 },
  url: { type: String, maxlength: 200 },
  doi: { type: String, maxlength: 80 },
  publicationName: { type: String, maxlength: 100 },
  citedBy: { type: Number, min: 0 },
  description: { type: String, maxlength: 150 },
  savedAt: { type: Date, default: Date.now }
}, { _id: true });

const CollectionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
    maxlength: 64
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  papers: {
    type: [PaperSchema],
    validate: [
      (arr) => Array.isArray(arr) && arr.length <= 50,
      'Bir koleksiyonda en fazla 50 makale olabilir.'
    ]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid duplicate collection names for the same user
CollectionSchema.index({ userId: 1, name: 1 }, { unique: true });

const Collection = mongoose.model('Collection', CollectionSchema);

export default Collection;
