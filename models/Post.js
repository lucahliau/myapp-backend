// models/Post.js
/*
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, required: true },
  description: {type: String, default: ""},
  uploader: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Post', PostSchema);
 */
// models/Post.js

const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  linkUrl: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  uploader: { type: String, required: true },
  price: { type: Number, required: true },
  priceRange: { type: String },
  createdAt: { type: Date, default: Date.now },
  "product_description:": { type: String }
});

module.exports = mongoose.model('Post', PostSchema);
