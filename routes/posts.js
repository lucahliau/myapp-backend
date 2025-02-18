const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');

// Base URL of the deployed Python recommendation service
const PYTHON_SERVICE_URL = 'https://recommendation-service-70za.onrender.com';

// Call the Python service to calculate clusters/preferences
async function callCalculatePreferences(likedDescriptions, dislikedDescriptions) {
  try {
    const payload = { likedDescriptions, dislikedDescriptions };
    const response = await axios.post(`${PYTHON_SERVICE_URL}/calculate_preferences`, payload);
    return response.data;
  } catch (err) {
    console.error('Error calling calculate_preferences service:', err);
    throw err;
  }
}

// Call the Python service to get recommendations
async function callRecommend(likedClusters, dislikedClusters, samplePosts) {
  try {
    const payload = { likedClusters, dislikedClusters, posts: samplePosts };
    const response = await axios.post(`${PYTHON_SERVICE_URL}/recommend`, payload);
    return response.data;
  } catch (err) {
    console.error('Error calling recommend service:', err);
    throw err;
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("Fetching posts for user:", req.user.id);
    // Get the user and populate likedPosts and dislikedPosts.
    let user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      console.log("Random post IDs:", randomPosts.map(p => p._id));
      return res.status(200).json(randomPosts);
    } else {
      console.log("User has at least 30 interactions.");
      // Build list of IDs already seen.
      const likedIds = user.likedPosts.map(post => post._id);
      const dislikedIds = user.dislikedPosts.map(post => post._id);
      const excludedIds = likedIds.concat(dislikedIds);
      console.log("Excluding posts with IDs:", excludedIds);

      let clusters;
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        if (Math.random() < 0.5) {
          console.log("Existing clusters found but recalculating clusters.");
          user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');
          const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
          const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
          console.log("Liked Descriptions (fresh):", likedDescriptions);
          console.log("Disliked Descriptions (fresh):", dislikedDescriptions);
          clusters = await callCalculatePreferences(likedDescriptions, dislikedDescriptions);
          console.log("Newly calculated clusters:", clusters);
          user.likedClusters = clusters.likedClusters;
          user.dislikedClusters = clusters.dislikedClusters;
          await user.save();
          console.log("Updated user with new clusters.");
        } else {
          console.log("Using existing clusters for recommendations.");
          clusters = { likedClusters: user.likedClusters, dislikedClusters: user.dislikedClusters };
        }
      } else {
        console.log("No clusters found. Calculating clusters from descriptions.");
        user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        console.log("Liked Descriptions (fresh):", likedDescriptions);
        console.log("Disliked Descriptions (fresh):", dislikedDescriptions);
        clusters = await callCalculatePreferences(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("Updated user with new clusters.");
      }

      // Sample 180 posts not yet seen.
      const samplePosts = await Post.aggregate([
        { $match: { _id: { $nin: excludedIds } } },
        { $sample: { size: 180 } },
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));

      let recommendedIds = await callRecommend(
        clusters.likedClusters,
        clusters.dislikedClusters,
        samplePosts
      );

      if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
        recommendedIds = recommendedIds.map(item => item.id);
      }
      console.log("Recommended Post IDs:", recommendedIds);

      // Fetch full post details for the recommended posts.
      const posts = await Post.find(
        { _id: { $in: recommendedIds } },
        { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 }
      );

      // Reorder posts to match order of recommendedIds.
      const postsMap = {};
      posts.forEach(post => {
        postsMap[post._id.toString()] = post;
      });
      const orderedPosts = recommendedIds.map(id => postsMap[id]).filter(Boolean);
      return res.status(200).json(orderedPosts);
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    return res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    return res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    console.log("GET /api/posts/" + req.params.id);
    const post = await Post.findById(req.params.id);
    if (!post) {
      console.log("Post not found for id:", req.params.id);
      return res.status(404).json({ message: 'Post not found' });
    }
    res.status(200).json({
      _id: post._id.toString(),
      "image_url:": post["image_url:"],
      "title:": post["title:"],
      uploader: post.uploader,
      "price:": post["price:"],
      priceRange: post.priceRange,
      "product_description:": post["product_description:"]
    });
  } catch (error) {
    console.error("Error in GET /:id", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

module.exports = router;
/*working one time version just local below
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { spawn } = require('child_process');
const axios = require('axios');

// Python runner for recommendation
function runPythonRecommendation(likedClusters, dislikedClusters, samplePosts) {
  return new Promise((resolve, reject) => {
    const dataToSend = JSON.stringify({
      likedClusters,
      dislikedClusters,
      posts: samplePosts
    });
    const pythonProcess = spawn('python3', ['./recommendation.py']);
    let result = '';

    pythonProcess.on('error', (err) => {
      console.error('Failed to start recommendation.py:', err);
      reject(err);
    });

    pythonProcess.on('exit', (code, signal) => {
      if (code === null) {
        console.error(`recommendation.py terminated due to signal: ${signal}`);
      }
    });

    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('recommendation.py timed out'));
    }, 240000);

    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', data => {
      console.error(`recommendation.py error: ${data}`);
    });

    pythonProcess.on('close', code => {
      clearTimeout(timeout);
      try {
        const recommendedPosts = JSON.parse(result);
        resolve(recommendedPosts);
      } catch (err) {
        reject(err);
      }
    });

    pythonProcess.stdin.write(dataToSend);
    pythonProcess.stdin.end();
  });
}

// Python runner for calculating preferences/clusters
function runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions) {
  return new Promise((resolve, reject) => {
    const dataToSend = JSON.stringify({
      likedDescriptions,
      dislikedDescriptions
    });
    const pythonProcess = spawn('python3', ['./calculatePreferences.py']);
    let result = '';

    pythonProcess.on('error', (err) => {
      console.error('Failed to start calculatePreferences.py:', err);
      reject(err);
    });

    pythonProcess.on('exit', (code, signal) => {
      if (code === null) {
        console.error(`calculatePreferences.py terminated due to signal: ${signal}`);
      }
    });

    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('calculatePreferences.py timed out'));
    }, 240000);

    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', data => {
      console.error(`calculatePreferences.py error: ${data}`);
    });

    pythonProcess.on('close', code => {
      clearTimeout(timeout);
      try {
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
    console.log("Fetching posts for user:", req.user.id);
    // Get the user and populate likedPosts and dislikedPosts.
    let user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      console.log("Random post IDs:", randomPosts.map(p => p._id));
      return res.status(200).json(randomPosts);
    } else {
      console.log("User has at least 30 interactions.");
      // Build list of IDs already seen.
      const likedIds = user.likedPosts.map(post => post._id);
      const dislikedIds = user.dislikedPosts.map(post => post._id);
      const excludedIds = likedIds.concat(dislikedIds);
      console.log("Excluding posts with IDs:", excludedIds);

      let clusters;
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        if (Math.random() < 0.5) {
          console.log("Existing clusters found but recalculating clusters.");
          user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');
          const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
          const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
          console.log("Liked Descriptions (fresh):", likedDescriptions);
          console.log("Disliked Descriptions (fresh):", dislikedDescriptions);
          clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
          console.log("Newly calculated clusters:", clusters);
          user.likedClusters = clusters.likedClusters;
          user.dislikedClusters = clusters.dislikedClusters;
          await user.save();
          console.log("Updated user with new clusters.");
        } else {
          console.log("Using existing clusters for recommendations.");
          clusters = { likedClusters: user.likedClusters, dislikedClusters: user.dislikedClusters };
        }
      } else {
        console.log("No clusters found. Calculating clusters from descriptions.");
        user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        console.log("Liked Descriptions (fresh):", likedDescriptions);
        console.log("Disliked Descriptions (fresh):", dislikedDescriptions);
        clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("Updated user with new clusters.");
      }

      // Sample 180 posts not yet seen.
      const samplePosts = await Post.aggregate([
        { $match: { _id: { $nin: excludedIds } } },
        { $sample: { size: 180 } },
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));

      let recommendedIds = await runPythonRecommendation(
        clusters.likedClusters,
        clusters.dislikedClusters,
        samplePosts
      );

      if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
        recommendedIds = recommendedIds.map(item => item.id);
      }
      console.log("Recommended Post IDs:", recommendedIds);

      // Fetch full post details for the recommended posts.
      const posts = await Post.find(
        { _id: { $in: recommendedIds } },
        { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 }
      );

      // Reorder posts to match order of recommendedIds.
      const postsMap = {};
      posts.forEach(post => {
        postsMap[post._id.toString()] = post;
      });
      const orderedPosts = recommendedIds.map(id => postsMap[id]).filter(Boolean);
      return res.status(200).json(orderedPosts);
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    return res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    return res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    console.log("GET /api/posts/" + req.params.id);
    const post = await Post.findById(req.params.id);
    if (!post) {
      console.log("Post not found for id:", req.params.id);
      return res.status(404).json({ message: 'Post not found' });
    }
    res.status(200).json({
      _id: post._id.toString(),
      "image_url:": post["image_url:"],
      "title:": post["title:"],
      uploader: post.uploader,
      "price:": post["price:"],
      priceRange: post.priceRange,
      "product_description:": post["product_description:"]
    });
  } catch (error) {
    console.error("Error in GET /:id", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

module.exports = router;
*/

