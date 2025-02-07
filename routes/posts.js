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
// Configure storage for image uploads (stores files in the 'uploads' folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }); */

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
  try {
    // Ensure the file is provided
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const { text } = req.body;
    // Construct the image URL (assuming you are serving static files from '/uploads')
    const imageUrl = `/uploads/${req.file.filename}`;

    // Check that req.user exists (set by your auth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Create a new post document including the uploader field
    const newPost = new Post({
      imageUrl,
      text,
      uploader: req.user.id  // This assumes your User model uses _id and your auth middleware sets req.user.id
    });

    await newPost.save();

    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    // Log the detailed error for debugging
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
