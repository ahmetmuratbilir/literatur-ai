import mongoose from 'mongoose';
import { ONBOARDING_OPTIONS } from '../config/onboarding.js';

const UserProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 64,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 120,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'Araştırmacı',
  },
  welcomeEmailSent: {
    type: Boolean,
    default: false,
    index: true,
  },
  welcomeEmailSentAt: {
    type: Date,
  },
  lastLoginAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // İlk giriş tanışma soruları (WO-024): yalnız sabit seçenekler.
  onboarding: {
    role: { type: String, enum: ONBOARDING_OPTIONS.role },
    purpose: { type: [{ type: String, enum: ONBOARDING_OPTIONS.purpose }], default: undefined },
    source: { type: String, enum: ONBOARDING_OPTIONS.source },
    answeredAt: Date,
    skippedAt: Date,
  },
});

const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

export default UserProfile;
