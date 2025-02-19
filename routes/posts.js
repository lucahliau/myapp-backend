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

// Helper function for on-demand recommendations
// sampleSize: number of posts to sample for the recommendation call
// returnCount: number of posts to return to the app (e.g. 30)
async function getOnDemandRecommendations(user, sampleSize, returnCount) {
  // Recalculate clusters from fresh liked/disliked descriptions
  const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
  const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
  const clusters = await callCalculatePreferences(likedDescriptions, dislikedDescriptions);
  user.likedClusters = clusters.likedClusters;
  user.dislikedClusters = clusters.dislikedClusters;
  
  // Sample posts that the user hasn’t seen yet.
  const likedIds = user.likedPosts.map(post => post._id);
  const dislikedIds = user.dislikedPosts.map(post => post._id);
  const excludedIds = likedIds.concat(dislikedIds);
  
  const samplePosts = await Post.aggregate([
    { $match: { _id: { $nin: excludedIds } } },
    { $sample: { size: sampleSize } },
    { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
  ]);
  
  // Get recommendations from the Python service.
  let recommendedIds = await callRecommend(clusters.likedClusters, clusters.dislikedClusters, samplePosts);
  if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
    recommendedIds = recommendedIds.map(item => item.id);
  }
  
  // Store the on-demand recommended posts in the user's field (only storing the full batch for later use)
  // For on-demand, we store only the posts returned by recommend (even if we return a subset to the client).
  user.recommendedPosts = recommendedIds;
  await user.save();
  
  // Fetch full details for the first "returnCount" recommended posts.
  const posts = await Post.find(
    { _id: { $in: recommendedIds.slice(0, returnCount) } },
    { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 }
  );
  
  // Reorder posts to match the recommended order.
  const postsMap = {};
  posts.forEach(post => {
    postsMap[post._id.toString()] = post;
  });
  const orderedPosts = recommendedIds.slice(0, returnCount).map(id => postsMap[id]).filter(Boolean);
  return orderedPosts;
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

    // Case 1: Fewer than 30 interactions -> return 30 random posts.
    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      return res.status(200).json(randomPosts);
    }

    // Case 2: 30 or more interactions.
    // Ensure clusters exist: if not, we’ll compute clusters and generate recommendations.
    if (!user.likedClusters || !user.dislikedClusters || !user.likedClusters.length || !user.dislikedClusters.length) {
      console.log("No clusters found. Calculating clusters and recommendations (on-demand sample size 180, returning 30).");
      const postsToReturn = await getOnDemandRecommendations(user, 180, 30);
      return res.status(200).json(postsToReturn);
    } else {
      // Clusters exist.
      // Check if the user has a recommendedPosts array with enough posts.
      if (!user.recommendedPosts || user.recommendedPosts.length < 10) {
        console.log("Recommended posts fewer than 10. Recalculating recommendations (on-demand sample size 180, returning 30).");
        const postsToReturn = await getOnDemandRecommendations(user, 180, 30);
        return res.status(200).json(postsToReturn);
      } else {
        // There are 10 or more posts stored. Return the first 30 posts from the stored recommendedPosts.
        console.log("Returning stored recommended posts from user.recommendedPosts.");
        // Make sure to return full post details.
        const recommendedSlice = user.recommendedPosts.slice(0, 30);
        const posts = await Post.find(
          { _id: { $in: recommendedSlice } },
          { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 }
        );
        // Reorder posts to match order.
        const postsMap = {};
        posts.forEach(post => {
          postsMap[post._id.toString()] = post;
        });
        const orderedPosts = recommendedSlice.map(id => postsMap[id]).filter(Boolean);
        return res.status(200).json(orderedPosts);
      }
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    return res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// ... other routes (e.g. /myPosts, /:id) remain unchanged.

module.exports = router;
