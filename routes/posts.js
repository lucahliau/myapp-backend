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

// GET /: Get posts for the mobile feed.
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("Fetching posts for user:", req.user.id);
    // Find the user and populate likedPosts and dislikedPosts
    const user = await User.findById(req.user.id)
      .populate('likedPosts')
      .populate('dislikedPosts');

    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    // Build an array of seen post IDs (assuming _id is stored as an ObjectId)
    const seenIds = user.likedPosts.concat(user.dislikedPosts).map(post => post._id);
    let postsToSend;

    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Fetching 30 random unseen posts.");
      postsToSend = await Post.aggregate([
        { $match: { _id: { $nin: seenIds } } },
        { $sample: { size: 30 } }
      ]);
      console.log("Post IDs fetched:", postsToSend.map(post => post._id));
      return res.status(200).json(postsToSend);
    } else {
      console.log("User has at least 30 interactions.");
      if (
        user.likedClusters && Array.isArray(user.likedClusters) && user.likedClusters.length > 0 &&
        user.dislikedClusters && Array.isArray(user.dislikedClusters) && user.dislikedClusters.length > 0
      ) {
        console.log("Using existing clusters for user:");
        console.log("Liked Clusters:", user.likedClusters);
        console.log("Disliked Clusters:", user.dislikedClusters);
        console.log("Fetching 180 unseen posts for recommendation.");
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: seenIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sample post IDs for recommendation:", samplePosts.map(post => post._id));
        const recommendedPosts = await runPythonRecommendation(
          user.likedClusters,
          user.dislikedClusters,
          samplePosts
        );
        console.log("Recommended post IDs:", recommendedPosts.map(post => post._id));
        return res.status(200).json(recommendedPosts);
      } else {
        console.log("No clusters found for user. Calculating clusters from liked/disliked post descriptions.");
        const likedDescriptions = user.likedPosts.map(post => post.description);
        const dislikedDescriptions = user.dislikedPosts.map(post => post.description);
        const clusters = await runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions);
        console.log("Calculated clusters:", clusters);
        // Update the user document with the new clusters.
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();
        console.log("User updated with new clusters.");
        const samplePosts = await Post.aggregate([
          { $match: { _id: { $nin: seenIds } } },
          { $sample: { size: 180 } }
        ]);
        console.log("Sample post IDs for recommendation:", samplePosts.map(post => post._id));
        const recommendedPosts = await runPythonRecommendation(
          clusters.likedClusters,
          clusters.dislikedClusters,
          samplePosts
        );
        console.log("Recommended post IDs:", recommendedPosts.map(post => post._id));
        return res.status(200).json(recommendedPosts);
      }
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
