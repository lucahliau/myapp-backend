// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
