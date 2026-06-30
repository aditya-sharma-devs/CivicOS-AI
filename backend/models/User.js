const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String
    // Optional for users registering via Google OAuth
  },
  googleId: {
    type: String
  },
  avatar: {
    type: String
  },
  securityQuestion: {
    type: String
  },
  securityAnswer: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
