/*// routes/posts.js
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
      description,
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
*/
// routes/posts.js
// routes/posts.js
// routes/posts.js
/*
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
// (Optionally, import a price categorization helper if it is in a separate module)
const { categorizePrice } = require('../utils'); // or define it inline

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

// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // Ensure an image file was provided.
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Extract fields from the request body.
    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 location URL

    // Ensure the uploader is authenticated.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // OPTIONAL: Log the received input.
    console.log("Received post data:", { title, description, linkUrl, price, imageUrl });

    // Run the vision processor (this function should combine the Vision API labels with the manual description and title).
    // It should return an object with keys that correspond to your extra Post fields (e.g. Color, Material, etc.).
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes:", computedAttributes);

    // Process the price.
    const priceValue = Number(price);
    const priceRange = categorizePrice(priceValue);

    // Create a new post document including the basic fields and the computed attributes.
    const newPost = new Post({
      imageUrl,
      title: title || "No title provided",
      description: description || "",
      linkUrl: linkUrl || "",
      uploader: req.user.id,
      price: priceValue,
      priceRange: priceRange,
      // Spread the computed attributes from the vision processor.
      ...computedAttributes
    });

    await newPost.save();
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
*/
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

// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // Ensure an image file was provided.
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Extract fields from the request body.
    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 location URL

    // Ensure the uploader is authenticated.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // OPTIONAL: Log the received input.
    console.log("Received post data:", { title, description, linkUrl, price, imageUrl });

    // Run the vision processor (this function should combine the Vision API labels with the manual description and title).
    // It should return an object with keys that correspond to your extra Post fields (e.g. Color, Material, etc.).
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes:", computedAttributes);

    // Process the price.
    const priceValue = Number(price);
    const priceRange = categorizePrice(priceValue);

    // Create a new post document including the basic fields and the computed attributes.
    const newPost = new Post({
      imageUrl,
      title: title || "No title provided",
      description: description || "",
      linkUrl: linkUrl || "",
      uploader: req.user.id,
      price: priceValue,
      priceRange: priceRange,
      // Spread the computed attributes from the vision processor.
      ...computedAttributes
    });

    await newPost.save();
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
