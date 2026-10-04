import mongoose from 'mongoose';

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
});

const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

export default UserProfile;
