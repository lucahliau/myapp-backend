const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User'); // Make sure you import your User model.
const authMiddleware = require('../middleware/auth');
const { spawn } = require('child_process');

// Helper function to run the recommendation Python script.
function runPythonRecommendation(likedClusters, dislikedClusters, samplePosts) {
  return new Promise((resolve, reject) => {
    const dataToSend = JSON.stringify({
      likedClusters,
      dislikedClusters,
      posts: samplePosts
    });
    // Adjust the path to recommendation.py as needed.
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

// Helper function to run the calculate preferences Python script.
function runPythonCalculatePreferences(likedDescriptions, dislikedDescriptions) {
  return new Promise((resolve, reject) => {
    const dataToSend = JSON.stringify({
      likedDescriptions,
      dislikedDescriptions
    });
    // Adjust the path to calculatePreferences.py as needed.
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

// GET /: Get posts for the mobile feed with recommendation logic.
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Find the user and populate likedPosts/dislikedPosts (so we can access their descriptions)
    const user = await User.findById(req.user.id)
      .populate('likedPosts dislikedPosts');

    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;

    if (totalInteractions < 30) {
      // User hasn't interacted enough; return 30 random posts.
      const randomPosts = await Post.aggregate([{ $sample: { size: 30 } }]);
      return res.status(200).json(randomPosts);
    } else {
      // User has at least 30 interactions.
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
        // Use the product_description field if available; otherwise fall back to description.
        const likedDescriptions = user.likedPosts.map(post => post.product_description || post.description);
        const dislikedDescriptions = user.dislikedPosts.map(post => post.product_description || post.description);
        
        const clusters = await runPythonCalculatePreferences(
          likedDescriptions,
          dislikedDescriptions
        );
        // Update the user document with the new clusters.
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
        await user.save();

        // Now run recommendation.py.
        const samplePosts = await Post.aggregate([{ $sample: { size: 180 } }]);
        const recommendedPosts = await runPythonRecommendation(
          clusters.likedClusters,
          clusters.dislikedClusters,
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

module.exports = router;
