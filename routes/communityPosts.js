// routes/communityPosts.js
const express = require('express');
const router = express.Router();
const CommunityPost = require('../models/CommunityPost');
const authMiddleware = require('../middleware/auth'); // Include if you want to require auth

// GET /communityPosts
// Returns all community posts, sorted by creation date (most recent first)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Fetch all community posts and sort them in descending order of creation date.
    const posts = await CommunityPost.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching community posts:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

module.exports = router;
