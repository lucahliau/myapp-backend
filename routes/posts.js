// routes/posts.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');

// Import the authentication middleware BEFORE using it in any routes.
const authMiddleware = require('../middleware/auth');

const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Configure AWS with your credentials and region from environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create an S3 instance
const s3 = new AWS.S3();

// Configure multer to use S3 for storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    //acl: 'public-read', // Set ACL to public-read if you want public URLs
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Create a unique file name. You can use Date.now() and file extension.
      cb(null, Date.now().toString() + path.extname(file.originalname));
    }
  })
});
/*
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const { text } = req.body;
    // Use the full URL provided by multer-s3.
    const imageUrl = req.file.location;  // This should be a full URL like https://myapp-image-uploads-1.s3.us-east-2.amazonaws.com/1738951520013.png

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const newPost = new Post({
      imageUrl,
      text,
      uploader: req.user.id
    });

    await newPost.save();

    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error in creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
});
*/
// Example: routes/posts.js
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    // Expecting the client to send both title and description.
    const { title, description } = req.body;
    // Create a new post document.
    const newPost = new Post({
      imageUrl: req.file.location || `/uploads/${req.file.filename}`,
      title: title || "No title provided",
      description: description || "",
      uploader: req.user.id
    });

    await newPost.save();
    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error in creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
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
