// models/communityPosts.js
const mongoose = require('mongoose');

const CommunityPostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  pageUrl: { type: String, required: true },
  category: { type: String, required: true },
  priceRange: { type: String },
  orderPosition: { type: Number, default: null }
}, {
  timestamps: true,
  // Specify a custom collection name to avoid conflicts with the Post model.
  collection: 'communityPosts'
});

module.exports = mongoose.model('CommunityPost', CommunityPostSchema);
