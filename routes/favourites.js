const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// POST /favourites/add
// Request body should include: { postId: "<post id>" }
router.post('/add', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.body;
    const user = await User.findById(req.user.id);
    
    // Remove the post from likedPosts if it exists.
    user.likedPosts = user.likedPosts.filter(
      id => id.toString() !== postId
    );
    
    // Add to favouritePosts if not already present.
    if (!user.favouritePosts.find(id => id.toString() === postId)) {
      user.favouritePosts.push(postId);
    }
    
    await user.save();
    return res.status(200).json({ message: "Post added to favourites." });
  } catch (err) {
    console.error("Error adding favourite:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// POST /favourites/remove
// Request body should include: { postId: "<post id>" }
router.post('/remove', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.body;
    const user = await User.findById(req.user.id);
    
    // Remove from favouritePosts.
    user.favouritePosts = user.favouritePosts.filter(
      id => id.toString() !== postId
    );
    
    // Optionally, add the post back to likedPosts if not already there.
    if (!user.likedPosts.find(id => id.toString() === postId)) {
      user.likedPosts.push(postId);
    }
    
    await user.save();
    return res.status(200).json({ message: "Post removed from favourites and added back to liked posts." });
  } catch (err) {
    console.error("Error removing favourite:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;
