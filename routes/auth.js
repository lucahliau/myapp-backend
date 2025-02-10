// routes/posts.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post'); // Make sure your Post model has the new fields including "linkUrl", "price", "priceRange" and an "attributes" object.
const authMiddleware = require('../middleware/auth');

// Import AWS SDK and multer-s3 for S3 storage.
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// Import your vision processor module.
// It should export an async function analyzeImageAndCategorize(imageUrl, description, title)
// that returns an object (one property per attribute) with at least a "chosen" value.
const visionProcessor = require('../visionProcessor');

// Configure AWS with credentials and region from environment variables.
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Configure multer to use S3 for file storage.
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    // Uncomment the next line if you want the images to be publicly accessible:
    // acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Use the current timestamp and the original file extension to create a unique key.
      cb(null, Date.now().toString() + path.extname(file.originalname));
    }
  })
});

// Helper function: categorize price into a bracket.
function categorizePrice(price) {
  if (price < 10) return "0-10";
  else if (price < 40) return "10-40";
  else if (price < 100) return "40-100";
  else if (price < 200) return "100-200";
  else if (price < 300) return "200-300";
  else return "300+";
}

// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // Check for an uploaded image.
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Extract user-provided fields from the request body.
    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 URL

    // Ensure the uploader is authenticated.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Convert price to a number and calculate its price range.
    const priceValue = Number(price);
    const priceBracket = categorizePrice(priceValue);

    // Call the vision processor to analyze the image along with the provided description and title.
    // This function should use your hybrid algorithm (vision + description + title) and return an object
    // where each key (e.g. "Color", "Material", etc.) maps to an object with a "chosen" property.
    const combinedCategorization = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Combined categorization from vision processor:", combinedCategorization);

    // Build the attributes object for the Post document.
    // We assume combinedCategorization is an object such as:
    // { Color: { chosen: "gray", score: 75, detailedScores: { ... } }, Material: { chosen: "leather", ... }, ... }
    let attributes = {};
    for (const attribute in combinedCategorization) {
      // Store the chosen adjective for each attribute.
      attributes[attribute] = combinedCategorization[attribute].chosen;
      // (If you want to store the detailed scores as well, you could include them in a nested object.)
    }

    // Create the new Post document.
    const newPost = new Post({
      imageUrl,
      linkUrl: linkUrl || "",
      title: title || "No title provided",
      description: description || "",
      uploader: req.user.id,
      price: priceValue,
      priceRange: priceBracket,
      attributes: attributes
    });

    await newPost.save();

    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
});

// GET /: Retrieve all posts (e.g. for the mobile feed).
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// GET /myPosts: Retrieve posts created by the authenticated uploader (desktop view).
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

