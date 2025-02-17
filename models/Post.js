// models/Post.js

const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  "image_url:": { type: String, required: true },
  "title:": { type: String, required: true },
  uploader: { type: String, required: true },
  "price:": { type: Number, required: true },
  priceRange: { type: String },
  "product_description:": { type: String }
});

module.exports = mongoose.model('Post', PostSchema);
