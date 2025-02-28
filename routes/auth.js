const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Signup endpoint
router.post('/signup', async (req, res) => {
  const { firstName, lastName, username, email, password } = req.body;
  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ 
      message: 'Please provide first name, last name, username, email, and password.' 
    });
  }
  try {
    const existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const existingUserUsername = await User.findOne({ username });
    if (existingUserUsername) {
      return res.status(400).json({ message: 'Username already in use' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword
    });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
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
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Protected profile endpoint
const authMiddleware = require('../middleware/auth');

// GET /api/auth/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // Find user and populate post fields as needed.
    const user = await User.findById(req.user.id)
      .populate('likedPosts dislikedPosts favouritePosts');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      profilePic: user.profilePic, // include profilePic
      likedPosts: user.likedPosts.map(post => post._id),
      dislikedPosts: user.dislikedPosts.map(post => post._id),
      favouritePosts: user.favouritePosts.map(post => post._id)
    });
  } catch (error) {
    console.error("Error in profile route:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// Update profile endpoint
router.put('/profile', authMiddleware, async (req, res) => {
  const { firstName, lastName, password, profilePic } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }
    if (profilePic) user.profilePic = profilePic;
    
    await user.save();
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

module.exports = router;
