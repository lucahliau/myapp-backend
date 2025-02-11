
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post'); // Make sure your Post model is updated with extra fields.
const authMiddleware = require('../middleware/auth');

const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Import your vision processor module (which you will have updated to export analyzeImageAndCategorize)
const visionProcessor = require('../visionProcessor');

//import queue
const visionQueue = require('../queue');

// Define the price categorization helper inline.
// The function returns a string based on the provided price value.
function categorizePrice(priceValue) {
  if (priceValue < 10) {
    return '0-10';
  } else if (priceValue < 50) {
    return '10-50';
  } else if (priceValue < 100) {
    return '50-100';
  } else if (priceValue < 200) {
    return '100-200';
  } else if (priceValue < 300) {
    return '200-300';
  } else {
    return '300+';
  }
}

// Configure AWS from environment variables.
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    // (If you want public access, you can uncomment the following line.)
    // acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Generate a unique file name using the current timestamp.
      cb(null, Date.now().toString() + path.extname(file.originalname));
    }
  })
});
/*
// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    
    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 image URL

    // Log the input values to see what you received
    console.log("Received post data:", { title, description, linkUrl, price, imageUrl });
    
    // Call the vision processor and log the computed attributes

    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes from vision processor:", computedAttributes);

    const priceValue = Number(price);
    const priceRange = categorizePrice(priceValue);
    console.log("Price value:", priceValue, "Price Range:", priceRange);

    const newPost = new Post({
      imageUrl,
      title: title || "No title provided",
      description: description || "",
      linkUrl: linkUrl || "",
      uploader: req.user.id,
      price: priceValue,
      priceRange: priceRange,
      ...computedAttributes
    });

    await newPost.save();
    console.log("New post saved:", newPost);
    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
});
*/

// Import our FlowProducer instance.
const flowProducer = require('../flowQueue');

// Import the Agenda instance so that we can enqueue a job.
const agenda = require('../agenda');

// POST /create route
// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 URL
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log("Received post data:", { title, description, linkUrl, price, imageUrl });

    // Create and save the post (attributes field will be updated later by the worker).
    const newPost = new Post({
      imageUrl,
      title: title || "No title provided",
      description: description || "",
      linkUrl: linkUrl || "",
      uploader: req.user.id,
      price: Number(price),
      priceRange: categorizePrice(Number(price)),
      attributes: {} // Initially empty; will be filled by the vision worker.
    });
    
    await newPost.save();

    // Enqueue a vision processing job for this post.
    await agenda.now('process vision job', {
      postId: newPost._id,
      imageUrl: newPost.imageUrl,
      description: newPost.description,
      title: newPost.title
    });

    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
});

// GET /: Get all posts (for the mobile feed).
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// GET /myPosts: Get posts uploaded by the authenticated user (desktop view).
router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

module.exports = router;

