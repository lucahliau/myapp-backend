
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post'); // Make sure your Post model is updated with extra fields.
const authMiddleware = require('../middleware/auth');
const { spawn } = require('child_process');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');


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




// POST /create route
// POST /create: Create a new post.
/*
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
*/
// GET /: Get all posts (for the mobile feed).
/*router.get('/', async (req, res) => {
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
});*/
function runPythonRecommendation(likedClusters, dislikedClusters, samplePosts) {
  return new Promise((resolve, reject) => {
    // Prepare the JSON payload for Python
    const dataToSend = JSON.stringify({
      likedClusters,
      dislikedClusters,
      posts: samplePosts
    });

    // Adjust the path to your python script as needed.
    const pythonProcess = spawn('python3', ['../recommendation.py']);

    let result = '';
    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', data => {
      console.error(`recommendation.py error: ${data}`);
    });

    pythonProcess.on('close', code => {
      try {
        const recommendedPosts = JSON.parse(result);
        resolve(recommendedPosts);
      } catch (err) {
        reject(err);
      }
    });

    // Write the JSON input to the Python script and close stdin.
    pythonProcess.stdin.write(dataToSend);
    pythonProcess.stdin.end();
  });
}

// Helper function to call calculatePreferences.py
function runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions) {
  return new Promise((resolve, reject) => {
    const dataToSend = JSON.stringify({
      likedDescriptions,
      dislikedDescriptions
    });

    // Adjust the path to your python script as needed.
    const pythonProcess = spawn('python3', ['../calculatePreferences.py']);

    let result = '';
    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', data => {
      console.error(`calculatePreferences.py error: ${data}`);
    });

    pythonProcess.on('close', code => {
      try {
        // Expecting an object like { likedClusters: [...], dislikedClusters: [...] }
        const clusters = JSON.parse(result);
        resolve(clusters);
      } catch (err) {
        reject(err);
      }
    });

    pythonProcess.stdin.write(dataToSend);
    pythonProcess.stdin.end();
  });
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get the user and populate liked/disliked posts (to access descriptions later)
    const user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;

    if (totalInteractions < 30) {
      // User hasn't interacted enough; return 30 random posts.
      const randomPosts = await Post.aggregate([{ $sample: { size: 30 } }]);
      return res.status(200).json(randomPosts);
    } else {
      // User has at least 30 interactions.
      // First, check if clusters already exist.
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        // Clusters exist: sample 180 posts and run recommendation.py
        const samplePosts = await Post.aggregate([{ $sample: { size: 180 } }]);
        const recommendedPosts = await runPythonRecommendation(
          user.likedClusters,
          user.dislikedClusters,
          samplePosts
        );
        return res.status(200).json(recommendedPosts);
      } else {
        // Clusters do not exist: calculate preferences first.
        // Extract descriptions from liked/disliked posts (adjust field name as needed)
        const likedDescriptions = user.likedPosts.map(post => post.description);
        const dislikedDescriptions = user.dislikedPosts.map(post => post.description);

        // Run calculatePreferences.py to get clusters.
        const { likedClusters, dislikedClusters } = await runPythonCalculatePreferences(
          likedDescriptions,
          dislikedDescriptions
        );

        // Update the user document with the new clusters.
        user.likedClusters = likedClusters;
        user.dislikedClusters = dislikedClusters;
        await user.save();

        // Now that clusters exist, run recommendation.py as before.
        const samplePosts = await Post.aggregate([{ $sample: { size: 180 } }]);
        const recommendedPosts = await runPythonRecommendation(
          likedClusters,
          dislikedClusters,
          samplePosts
        );
        return res.status(200).json(recommendedPosts);
      }
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
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

