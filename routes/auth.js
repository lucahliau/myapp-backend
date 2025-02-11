// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Signup endpoint
// routes/auth.js
router.post('/signup', async (req, res) => {
  const { email, password, userType } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, userType });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    // Log the detailed error to the Heroku logs
    console.error("Error in signup route:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});


// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

//added after
// routes/auth.js
const authMiddleware = require('../middleware/auth'); // ensure you have authentication middleware

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // Find the user by the ID from the token and populate the liked and disliked posts
    const user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      likedPosts: user.likedPosts,
      dislikedPosts: user.dislikedPosts
    });
  } catch (error) {
    console.error("Error in profile route:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

module.exports = router;
