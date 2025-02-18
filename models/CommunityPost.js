// models/communityPosts.js
const mongoose = require('mongoose');

const CommunityPostSchema = new mongoose.Schema({
  "image_url:": { type: String, required: true },
  "title:": { type: String, required: true },
  uploader: { type: String, required: true },
  "price:": { type: Number, required: true },
  priceRange: { type: String },
  "product_description:": { type: String }
}, timestamps: true,
  // Specify a custom collection name to avoid conflicts with the Post model.
  collection: 'communityPosts'});


module.exports = mongoose.model('CommunityPost', CommunityPostSchema);
