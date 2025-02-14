// models/User.js
const mongoose = require('mongoose');

// models/User.js
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, enum: ['upload', 'mobile'], required: true },
  likedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  dislikedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  likedClusters: { type: Array, default: [] },
  dislikedClusters: { type: Array, default: [] }
});


module.exports = mongoose.model('User', UserSchema);
