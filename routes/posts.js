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

module.exports = router;
*/
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
      // Determine whether to use existing clusters or recalculate new ones.
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length
      ) {
        // 50% chance to recalculate clusters even if they exist.
        if (Math.random() < 0.5) {
          console.log("Existing clusters found but deciding to recalculate new clusters for recommendations.");
          // Extract non-empty descriptions from liked and disliked posts.
          const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
          const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
          console.log("Liked Descriptions:", likedDescriptions);
          console.log("Disliked Descriptions:", dislikedDescriptions);
          
          // Run Python script to calculate preference clusters.
          const clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
          console.log("Calculated new clusters:", clusters);
          
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
        } else {
          console.log("Using existing clusters for recommendations.");
          // Sample 180 posts that are not in the excludedIds.
          const samplePosts = await Post.aggregate([
            { $match: { _id: { $nin: excludedIds } } },
            { $sample: { size: 180 } }
          ]);
          console.log("Sampled post IDs for recommendation:", samplePosts.map(p => p._id));
          // Run the Python recommendation script using existing clusters.
          recommendedIds = await runPythonRecommendation(
            user.likedClusters,
            user.dislikedClusters,
            samplePosts
          );
        }
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
