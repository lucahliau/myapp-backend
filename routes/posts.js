// routes/posts.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');

// Configure storage for image uploads (stores files in the 'uploads' folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Create Post endpoint (for desktop upload)
/*router.post('/create', upload.single('image'), async (req, res) => {
  const { text } = req.body;
  // Note: In production, you’d likely upload the file to cloud storage (e.g., AWS S3)
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const newPost = new Post({ imageUrl, text });
    await newPost.save();
    res.status(201).json({ message: 'Post created successfully', post: newPost });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});*/
//below is updated create post endpoint
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  const { text } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  // IMPORTANT: Save the uploader so you can later filter "my posts"
  const newPost = new Post({ imageUrl, text, uploader: req.user.id });
  await newPost.save();
  res.status(201).json({ message: 'Post created successfully', post: newPost });
});

// Get Posts endpoint (for mobile feed)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

//get posts endpoint for desktop
// Assuming each post document includes a field like uploader: userId
const authMiddleware = require('../middleware/auth');

// Endpoint to fetch posts created by the authenticated upload user
router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    // Assuming req.user.id contains the user's ID from the token
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
});


module.exports = router;
