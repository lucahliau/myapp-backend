
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
const defaultAttributes = {
  // Color:
  Red: 0,
  Orange: 0,
  Yellow: 0,
  Gold: 0,
  Olive: 0,
  Green: 0,
  Teal: 0,
  Cyan: 0,
  "Sky Blue": 0,
  Blue: 0,
  Navy: 0,
  Indigo: 0,
  Purple: 0,
  Lavender: 0,
  Magenta: 0,
  Pink: 0,
  Brown: 0,
  Gray: 0,
  // Material:
  Cotton: 0,
  Linen: 0,
  Wool: 0,
  Cashmere: 0,
  Silk: 0,
  Satin: 0,
  Rayon: 0,
  Polyester: 0,
  Acrylic: 0,
  Nylon: 0,
  Spandex: 0,
  Denim: 0,
  Corduroy: 0,
  Tweed: 0,
  Leather: 0,
  Suede: 0,
  Fleece: 0,
  Velvet: 0,
  Jersey: 0,
  // Clothing Item Type:
  "T-shirt": 0,
  Polo: 0,
  boots: 0,
  shoes: 0,
  "Button-down Shirt": 0,
  Blouse: 0,
  "Tank Top": 0,
  Sweater: 0,
  Hoodie: 0,
  Jacket: 0,
  Blazer: 0,
  Coat: 0,
  Jeans: 0,
  Trousers: 0,
  Shorts: 0,
  Skirt: 0,
  Dress: 0,
  Jumpsuit: 0,
  Leggings: 0,
  accessories: 0,
  Swimsuit: 0,
  // Era:
  "1920s": 0,
  "1930s": 0,
  "1940s": 0,
  "1950s": 0,
  "1960s": 0,
  "1970s": 0,
  "1980s": 0,
  "1990s": 0,
  "2000s": 0,
  "2010s": 0,
  "2020s": 0,
  Futuristic: 0,
  Cyberpunk: 0,
  // Gender:
  "Men's": 0,
  "Women's": 0,
  Unisex: 0,
  // Season:
  Winter: 0,
  Spring: 0,
  Summer: 0,
  Fall: 0,
  // Pattern:
  Solid: 0,
  Striped: 0,
  Plaid: 0,
  Checkered: 0,
  "Polka Dot": 0,
  Floral: 0,
  Paisley: 0,
  Houndstooth: 0,
  Herringbone: 0,
  Geometric: 0,
  Camouflage: 0,
  "Animal Print": 0,
  "Tie-Dye": 0,
  Gradient: 0,
  Abstract: 0,
  // Country/World Region:
  USA: 0,
  UK: 0,
  France: 0,
  Italy: 0,
  Spain: 0,
  Germany: 0,
  Scandinavia: 0,
  Japan: 0,
  China: 0,
  India: 0,
  "Middle East": 0,
  Africa: 0,
  "South America": 0,
  Australia: 0,
  "Eastern Europe": 0,
  Russia: 0,
  // Embellishments:
  Embroidery: 0,
  Sequins: 0,
  Lace: 0,
  Beads: 0,
  Studs: 0,
  Rhinestones: 0,
  Fringe: 0,
  Tassels: 0,
  Pearls: 0,
  Feathers: 0,
  Bows: 0,
  Buttons: 0,
  Patches: 0,
  "Metal Chains": 0,
  Zippers: 0,
  Cutouts: 0,
  "Fur Trim": 0,
  // Style:
  luxury: 0,
  formal: 0,
  minimalist: 0,
  plain: 0,
  preppy: 0,
  "Business Casual": 0,
  casual: 0,
  Streetwear: 0,
  grunge: 0,
  punk: 0,
  goth: 0,
  vintage: 0,
  Y2K: 0,
  Athleisure: 0,
  sport: 0,
  western: 0
};

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


// Import the Agenda instance so that we can enqueue a job.
const agenda = require('../agenda');

// POST /create route
// POST /create: Create a new post.
router.post('/create', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    // Check for an image file
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Extract the required fields from the request body.
    const { title, description, linkUrl, price } = req.body;
    const imageUrl = req.file.location; // S3 URL

    // Ensure the uploader is authenticated.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log("Received post data:", { title, description, linkUrl, price, imageUrl });

    // Create and save the post (the attributes field will be updated later by the vision worker).
    const newPost = new Post({
      imageUrl,
      title: title || "No title provided",
      description: description || "",
      linkUrl: linkUrl || "",
      uploader: req.user.id,
      price: Number(price),
      priceRange: categorizePrice(Number(price)),
      attributes: {} // initially empty; to be updated by the vision job
    });

    await newPost.save();
    console.log(`New post created with id: ${newPost._id}`);

    // Enqueue a vision processing job for this post.
    // The job data includes the post id, image URL, description, and title.
    await agenda.now('process vision job', {
      postId: newPost._id,
      imageUrl: newPost.imageUrl,
      description: newPost.description,
      title: newPost.title
    });
    console.log(`Enqueued vision job for post ${newPost._id}`);

    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Error creating post", error: error.toString() });
  }
});

// GET /: Get all posts (for the mobile feed).
router.get('/', async (req, res) => {
  try {
    // Get the page from the query string (default to 1 if not provided)
    const page = parseInt(req.query.page) || 1;
    const limit = 30; // number of posts per page
    const skip = (page - 1) * limit;

    // Find posts, sort them, skip and limit accordingly
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
});/

module.exports = router;

