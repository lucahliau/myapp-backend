// routes/interactions.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
// We’ll use a simple authentication middleware (to be created next)
const authMiddleware = require('../middleware/auth');

// Endpoint to record swipe actions (like/dislike)
router.post('/swipe', authMiddleware, async (req, res) => {
  const { postId, action } = req.body; // action should be 'like' or 'dislike'
  const userId = req.user.id; // Set by auth middleware
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (action === 'like') {
      user.likedPosts.push(postId);
    } else if (action === 'dislike') {
      user.dislikedPosts.push(postId);
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await user.save();
    res.status(200).json({ message: 'Action recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
