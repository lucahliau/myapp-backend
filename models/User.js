// models/User.js
const mongoose = require('mongoose');

// models/User.js
const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  likedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  dislikedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  likedClusters: { type: Array, default: [] },
  dislikedClusters: { type: Array, default: [] },
  recommendedPosts: { type: Array, default: [] },
  recentBatch: { type: Array, default: [] }
});


module.exports = mongoose.model('User', UserSchema);
