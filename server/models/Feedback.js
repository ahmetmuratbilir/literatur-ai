import mongoose from 'mongoose';
import { FEEDBACK_KINDS, FEEDBACK_MAX } from '../routes/feedback.js';

/** Yardım ve destek penceresinden gelen geri bildirim (WO-024). */
const FeedbackSchema = new mongoose.Schema({
  userId: { type: String, required: true, maxlength: 64, index: true },
  kind: { type: String, enum: FEEDBACK_KINDS, required: true },
  message: { type: String, required: true, maxlength: FEEDBACK_MAX },
  page: { type: String, maxlength: 80 },
  contactOk: { type: Boolean, default: false },
  // Yalnız kullanıcı dönüşe izin verdiyse dolu.
  email: { type: String, maxlength: 200 },
  name: { type: String, maxlength: 100 },
  userAgent: { type: String, maxlength: 200 },
  emailed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model('Feedback', FeedbackSchema);
