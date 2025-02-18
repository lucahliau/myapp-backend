// routes/communityPosts.js
const express = require('express');
const router = express.Router();
const CommunityPost = require('../models/CommunityPost');
const authMiddleware = require('../middleware/auth');

// GET /communityPosts
// Returns all community posts sorted by orderPosition (lowest number = most popular)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Sort by orderPosition ascending (1 is the top post)
    const posts = await CommunityPost.find().sort({ orderPosition: 1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

module.exports = router;
