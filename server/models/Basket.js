import mongoose from 'mongoose';

// Kaynak sepeti: kullanıcının aramalar arasında topladığı makaleler.
// Yazar modu bu makalelerle çalıştığı için alanlar /api/writer/generate'in
// kullandığı sınırlarla aynı (özet 600 karakter).
// Bir makale ≈ 1,6 KB; 30 makale × 1,6 KB ≈ 48 KB / kullanıcı.
export const BASKET_LIMIT = 30;

const BasketPaperSchema = new mongoose.Schema({
  title: { type: String, maxlength: 200 },
  authors: { type: String, maxlength: 150 },
  year: { type: String, maxlength: 8 },
  publicationName: { type: String, maxlength: 150 },
  citedBy: { type: Number, min: 0 },
  description: { type: String, maxlength: 600 },
  doi: { type: String, maxlength: 100 },
  url: { type: String, maxlength: 300 },
  source: { type: String, maxlength: 40 },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const BasketSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, maxlength: 64 },
  papers: {
    type: [BasketPaperSchema],
    validate: [
      (arr) => Array.isArray(arr) && arr.length <= BASKET_LIMIT,
      `Sepette en fazla ${BASKET_LIMIT} makale olabilir.`
    ]
  },
  // Eski koleksiyonlar bir kez sepete aktarıldı mı
  migratedCollections: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Basket', BasketSchema);
