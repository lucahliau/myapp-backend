// models/Post.js

const mongoose = require('mongoose');

// Completely replace the old schema with this new one
const PostSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  pageUrl: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  description: { 
    type: String 
  },
  imageUrl: { 
    type: String 
  },
  // Assuming 'embedding' is stored as a JSON array of numbers in the CSV
  embedding: { 
    type: [Number], 
    default: [] 
  },
  category: { 
    type: String 
  },
  gender: { 
    type: String 
  },
  // 'attributes' can be a JSON object, so we use 'Mixed' or an Object type
  attributes: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  }
}, {
  timestamps: true // Optional: adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Post', PostSchema);
