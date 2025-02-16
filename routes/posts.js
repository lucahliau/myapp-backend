// routes/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User'); // Ensure you have a User model
const authMiddleware = require('../middleware/auth');
const { spawn } = require('child_process');

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

    // Handle error when spawning the process
    pythonProcess.on('error', (err) => {
      console.error('Failed to start recommendation.py:', err);
      reject(err);
    });

    // Log if the process exits due to a signal
    pythonProcess.on('exit', (code, signal) => {
      if (code === null) {
        console.error(`recommendation.py terminated due to signal: ${signal}`);
      }
    });

    // Set a timeout to kill the process if it hangs (12 seconds here)
    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('recommendation.py timed out'));
    }, 120000);

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

    // Handle error when spawning the process
    pythonProcess.on('error', (err) => {
      console.error('Failed to start calculatePreferences.py:', err);
      reject(err);
    });

    // Log if the process exits due to a signal
    pythonProcess.on('exit', (code, signal) => {
      if (code === null) {
        console.error(`calculatePreferences.py terminated due to signal: ${signal}`);
      }
    });

    // Set a timeout to kill the process if it hangs (120 seconds here)
    const timeout = setTimeout(() => {
      pythonProcess.kill('SIGTERM');
      reject(new Error('calculatePreferences.py timed out'));
    }, 120000);

    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });
    pythonProcess.stderr.on('data', data => {
      console.error(`calculatePreferences.py error: ${data}`);
    });
    pythonProcess.on('close', code => {
      clearTimeout(timeout);
      try {
        const clusters = JSON.parse(result); // Expected format: { likedClusters: [...], dislikedClusters: [...] }
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
    // Retrieve the user and populate likedPosts and dislikedPosts.
    const user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    // Calculate total interactions.
    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      // Return 30 random posts with only the specified fields.
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 } }
      ]);
      console.log("Random post IDs:", randomPosts.map(p => p._id));
      return res.status(200).json(randomPosts);
    } else {
      console.log("User has at least 30 interactions.");
      // Create an array of IDs from likedPosts and dislikedPosts.
      const likedIds = user.likedPosts.map(post => post._id);
      const dislikedIds = user.dislikedPosts.map(post => post._id);
      const excludedIds = likedIds.concat(dislikedIds);
      console.log("Excluding posts with IDs:", excludedIds);

      let recommendedIds;

      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        console.log("Using existing clusters for recommendations.");
        console.log("Liked Clusters:", user.likedClusters);
        console.log("Disliked Clusters:", user.dislikedClusters);
        // Sample 180 posts that are not in the excludedIds.
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: excludedIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));
        // Run the Python recommendation script.
        recommendedIds = await runPythonRecommendation(
          user.likedClusters,
          user.dislikedClusters,
          samplePosts
        );
      } else {
        console.log("No clusters found for user. Calculating clusters from liked/disliked descriptions.");
        // Extract non-empty descriptions from liked and disliked posts.
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        console.log("Liked Descriptions:", likedDescriptions);
        console.log("Disliked Descriptions:", dislikedDescriptions);
        
        // Run Python script to calculate preference clusters.
        const clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        
        // Update the user document with the new clusters.
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("Updated user with new clusters.");

        // Now sample 180 posts that the user hasn't seen.
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: excludedIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));
        // Run the recommendation script using the newly calculated clusters.
        recommendedIds = await runPythonRecommendation(
          clusters.likedClusters,
          clusters.dislikedClusters,
          samplePosts
        );
      }

      // If recommendedIds are objects, extract the id property.
      if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
        recommendedIds = recommendedIds.map(item => item.id);
      }

      // Now, fetch the full post details for these IDs from MongoDB (only the specified fields).
      const posts = await Post.find(
        { _id: { $in: recommendedIds } },
        { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 }
      );

      // (Optional) Reorder the posts to match the order of recommendedIds.
      const postsMap = {};
      posts.forEach(post => {
        postsMap[post._id.toString()] = post;
      });
      const orderedPosts = recommendedIds.map(id => postsMap[id]).filter(Boolean);

      return res.status(200).json(orderedPosts);
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// GET /myPosts: Get posts uploaded by the authenticated user.
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
/*
// routes/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User'); // Ensure you have a User model
const authMiddleware = require('../middleware/auth');
const { spawn } = require('child_process');

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
    pythonProcess.stdout.on('data', data => {
      result += data.toString();
    });
    pythonProcess.stderr.on('data', data => {
      console.error(`calculatePreferences.py error: ${data}`);
    });
    pythonProcess.on('close', code => {
      try {
        const clusters = JSON.parse(result); // Expected format: { likedClusters: [...], dislikedClusters: [...] }
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
    // Retrieve the user and populate likedPosts and dislikedPosts.
    const user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    // Calculate total interactions.
    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      // Return 30 random posts with only the specified fields.
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 } }
      ]);
      console.log("Random post IDs:", randomPosts.map(p => p._id));
      return res.status(200).json(randomPosts);
    } else {
      console.log("User has at least 30 interactions.");
      // Create an array of IDs from likedPosts and dislikedPosts.
      const likedIds = user.likedPosts.map(post => post._id);
      const dislikedIds = user.dislikedPosts.map(post => post._id);
      const excludedIds = likedIds.concat(dislikedIds);
      console.log("Excluding posts with IDs:", excludedIds);

      let recommendedIds;

      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        console.log("Using existing clusters for recommendations.");
        console.log("Liked Clusters:", user.likedClusters);
        console.log("Disliked Clusters:", user.dislikedClusters);
        // Sample 180 posts that are not in the excludedIds.
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: excludedIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));
        // Run the Python recommendation script.
        recommendedIds = await runPythonRecommendation(
          user.likedClusters,
          user.dislikedClusters,
          samplePosts
        );
      } else {
        console.log("No clusters found for user. Calculating clusters from liked/disliked descriptions.");
        // Extract non-empty descriptions from liked and disliked posts.
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        console.log("Liked Descriptions:", likedDescriptions);
        console.log("Disliked Descriptions:", dislikedDescriptions);
        
        // Run Python script to calculate preference clusters.
        const clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        
        // Update the user document with the new clusters.
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("Updated user with new clusters.");

        // Now sample 180 posts that the user hasn't seen.
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: excludedIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));
        // Run the recommendation script using the newly calculated clusters.
        recommendedIds = await runPythonRecommendation(
          clusters.likedClusters,
          clusters.dislikedClusters,
          samplePosts
        );
      }

      // If recommendedIds are objects, extract the id property.
      if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
        recommendedIds = recommendedIds.map(item => item.id);
      }

      // Now, fetch the full post details for these IDs from MongoDB (only the specified fields).
      const posts = await Post.find(
        { _id: { $in: recommendedIds } },
        { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 }
      );

      // (Optional) Reorder the posts to match the order of recommendedIds.
      const postsMap = {};
      posts.forEach(post => {
        postsMap[post._id.toString()] = post;
      });
      const orderedPosts = recommendedIds.map(id => postsMap[id]).filter(Boolean);

      return res.status(200).json(orderedPosts);
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// GET /myPosts: Get posts uploaded by the authenticated user.
router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

module.exports = router;above is working old version internal*/
/* below is external version
// routes/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');

// Helper function to call the calculate preferences service via HTTP.
async function getClusters(likedDescriptions, dislikedDescriptions) {
  try {
    const response = await axios.post(
      'https://recommendation-service-70za.onrender.com/calculatePreferences',
      { likedDescriptions, dislikedDescriptions }
    );
    return response.data; // Expected: { likedClusters: [...], dislikedClusters: [...] }
  } catch (error) {
    console.error("Error calling calculate preferences service:", error);
    throw error;
  }
}

// Helper function to call the recommendation service via HTTP.
async function getRecommendedPosts(likedClusters, dislikedClusters, samplePosts) {
  try {
    const response = await axios.post(
      'https://recommendation-service-70za.onrender.com/recommend',
      { likedClusters, dislikedClusters, posts: samplePosts }
    );
    return response.data; // Expected: an array of recommended posts (or their IDs)
  } catch (error) {
    console.error("Error calling recommendation service:", error);
    throw error;
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("Fetching posts for user:", req.user.id);
    // Retrieve the user and populate likedPosts/dislikedPosts.
    const user = await User.findById(req.user.id).populate('likedPosts dislikedPosts');

    // Calculate total interactions.
    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked and ${dislikedCount} disliked posts (total: ${totalInteractions}).`);

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 } }
      ]);
      console.log("Random post IDs:", randomPosts.map(p => p._id));
      return res.status(200).json(randomPosts);
    } else {
      console.log("User has at least 30 interactions.");
      // Build the list of already seen post IDs.
      const likedIds = user.likedPosts.map(post => post._id);
      const dislikedIds = user.dislikedPosts.map(post => post._id);
      const excludedIds = likedIds.concat(dislikedIds);
      console.log("Excluding posts with IDs:", excludedIds);

      let clusters;
      // If clusters already exist, use them (with a 50% chance to recalc).
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        if (Math.random() < 0.5) {
          console.log("Existing clusters found but recalculating clusters.");
          const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
          const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
          console.log("Liked Descriptions:", likedDescriptions);
          console.log("Disliked Descriptions:", dislikedDescriptions);
          clusters = await getClusters(likedDescriptions, dislikedDescriptions);
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
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        console.log("Liked Descriptions:", likedDescriptions);
        console.log("Disliked Descriptions:", dislikedDescriptions);
        clusters = await getClusters(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("Updated user with new clusters.");
      }

      // Sample 180 posts that the user hasn't seen.
      const samplePosts = await Post.aggregate([
        { $match: { _id: { $nin: excludedIds } } },
        { $sample: { size: 180 } },
        { $project: { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 } }
      ]);
      console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));

      let recommendedIds = await getRecommendedPosts(
        clusters.likedClusters,
        clusters.dislikedClusters,
        samplePosts
      );

      // If the service returns objects, extract the 'id' field.
      if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
        recommendedIds = recommendedIds.map(item => item.id);
      }
      console.log("Recommended Post IDs:", recommendedIds);

      // Finally, fetch full details for the recommended posts.
      const posts = await Post.find(
        { _id: { $in: recommendedIds } },
        { _id: 1, "image_url:": 1, "product_description:": 1, "title:": 1, "price:": 1 }
      );

      // Optionally reorder to match the order of recommendedIds.
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

// GET /myPosts: Get posts uploaded by the authenticated user.
router.get('/myPosts', authMiddleware, async (req, res) => {
  try {
    const myPosts = await Post.find({ uploader: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(myPosts);
  } catch (error) {
    console.error("Error fetching myPosts:", error);
    return res.status(500).json({ message: "Server error", error: error.toString() });
  }
});

module.exports = router;
*/
