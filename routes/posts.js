const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');
// Import ObjectId conversion from mongoose.
const { ObjectId } = require('mongoose').Types;

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
    let recommendedIds = response.data;
    if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
      recommendedIds = recommendedIds.map(item => item.id);
    }
    return recommendedIds;
  } catch (err) {
    console.error('Error calling recommend service:', err);
    throw err;
  }
}

/**
 * Helper function for the on-demand recommendation flow.
 *   - sampleSize: number of posts to sample for recommendation (180 when on-demand)
 *   - returnCount: number of posts to return to the mobile app (30 posts)
 * It also saves the full set of recommended posts in the user.recommendedPosts.
 */
async function getOnDemandRecommendations(user, sampleSize, returnCount) {
  // Build the combined liked descriptions.
  const likedDescriptions = user.likedPosts.map(post => post.description).filter(Boolean);
  const favDescriptions = (user.favouritePosts || []).map(post => post.description).filter(Boolean);
  // Duplicate each favourite description 10x.
  const weightedFavDescriptions = favDescriptions.flatMap(desc => Array(10).fill(desc));
  const combinedLikedDescriptions = likedDescriptions.concat(weightedFavDescriptions);
  
  const dislikedDescriptions = user.dislikedPosts.map(post => post.description).filter(Boolean);
  const clusters = await callCalculatePreferences(combinedLikedDescriptions, dislikedDescriptions);
  user.likedClusters = clusters.likedClusters;
  user.dislikedClusters = clusters.dislikedClusters;
  
  // Exclude posts already seen (liked/disliked)
  const likedIds = user.likedPosts.map(post => post._id);
  const dislikedIds = user.dislikedPosts.map(post => post._id);
  const excludedIds = likedIds.concat(dislikedIds);
  
  const samplePosts = await Post.aggregate([
    { $match: { _id: { $nin: excludedIds } } },
    { $sample: { size: sampleSize } },
    { $project: { _id: 1, imageUrl: 1, title: 1, price: 1, description: 1, pageUrl: 1 } }
 }
  ]);
  
  // Get recommendations from the Python service.
  let recommendedIds = await callRecommend(clusters.likedClusters, clusters.dislikedClusters, samplePosts);
  
  // Save the complete set of recommendations in the user's field.
  user.recommendedPosts = recommendedIds;
  await user.save();
  
  // Fetch the first "returnCount" posts for the mobile app.
  const posts = await Post.find(
    { _id: { $in: recommendedIds.slice(0, returnCount).map(id => ObjectId(id)) } },
    { $project: { _id: 1, imageUrl: 1, title: 1, price: 1, description: 1, pageUrl: 1 } }
  );
  const postsMap = {};
  posts.forEach(post => {
    postsMap[post._id.toString()] = post;
  });
  const orderedPosts = recommendedIds.slice(0, returnCount).map(id => postsMap[id]).filter(Boolean);
  return { orderedPosts, newRecIds: recommendedIds };
}

/**
 * Backup update function that is used by the scheduler
 * and also called after sending a batch to the mobile app.
 *
 * It uses ALL posts (or you could change the sampling if needed) but
 * excludes any posts that are in likedPosts, dislikedPosts, or the recentBatch.
 * It then runs the recommendation algorithm and stores the top 50 posts.
 */
async function updateBackupRecommendations(user) {
  try {
    // Recalculate clusters if needed.
    if (!user.likedClusters || !user.dislikedClusters || !user.likedClusters.length || !user.dislikedClusters.length) {
      const likedDescriptions = user.likedPosts.map(post => post.description).filter(Boolean);
      const favDescriptions = (user.favouritePosts || []).map(post => post.description).filter(Boolean);
      const weightedFavDescriptions = favDescriptions.flatMap(desc => Array(10).fill(desc));
      const combinedLikedDescriptions = likedDescriptions.concat(weightedFavDescriptions);
      
      const dislikedDescriptions = user.dislikedPosts.map(post => post.description).filter(Boolean);
      const clusters = await callCalculatePreferences(combinedLikedDescriptions, dislikedDescriptions);
      user.likedClusters = clusters.likedClusters;
      user.dislikedClusters = clusters.dislikedClusters;
    }
    
    // Exclude posts: liked, disliked, and the most recent batch (if any)
    const likedIds = user.likedPosts.map(post => post._id);
    const dislikedIds = user.dislikedPosts.map(post => post._id);
    const recentBatch = user.recentBatch || [];
    // Convert the recentBatch IDs from strings to ObjectId.
    const convertedRecentBatch = recentBatch.map(id => ObjectId(id));
    const excludedIds = likedIds.concat(dislikedIds, convertedRecentBatch);
    
    // Sample ALL posts but exclude those already seen or recently sent.
    const samplePosts = await Post.aggregate([
      { $match: { _id: { $nin: excludedIds } } },
      { $project: { _id: 1, imageUrl: 1, title: 1, price: 1, description: 1 } }
    ]);
    
    let recommendedIds = await callRecommend(user.likedClusters, user.dislikedClusters, samplePosts);
    // Save only the top 50 recommendations.
    user.recommendedPosts = recommendedIds.slice(0, 50);
    await user.save();
    console.log(`Backup recommendations updated for user ${user._id}`);
  } catch (error) {
    console.error("Error updating backup recommendations:", error);
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("Fetching posts for user:", req.user.id);
    // Get the user and populate likedPosts, dislikedPosts, and favouritePosts.
    let user = await User.findById(req.user.id).populate('likedPosts dislikedPosts favouritePosts');
    const likedCount = user.likedPosts ? user.likedPosts.length : 0;
    const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
    const totalInteractions = likedCount + dislikedCount;
    console.log(`User ${req.user.id} has ${likedCount} liked posts and ${dislikedCount} disliked posts. Total interactions = ${totalInteractions}`);

    // Case 1: Fewer than 30 interactions → return 30 random posts.
    if (totalInteractions < 30) {
      console.log("Total interactions less than 30. Returning 30 random posts.");
      const randomPosts = await Post.aggregate([
        { $sample: { size: 30 } },
        { $project: { _id: 1, imageUrl: 1, title: 1, price: 1, description: 1 } }
      ]);
      return res.status(200).json(randomPosts);
    }

    // Case 2: 30 or more interactions.
    // When clusters are missing, or if recommendedPosts are nearly empty (<10), run the on-demand flow.
    if (
      !user.likedClusters || !user.dislikedClusters ||
      !user.likedClusters.length || !user.dislikedClusters.length ||
      !user.recommendedPosts || user.recommendedPosts.length < 10
    ) {
      console.log("No clusters or insufficient backup recommendations. Running on-demand flow (sample=180, return=30).");
      const { orderedPosts, newRecIds } = await getOnDemandRecommendations(user, 180, 30);
      // Save the sent batch as the recentBatch.
      user.recentBatch = newRecIds.slice(0, 30);
      await user.save();
      // Also, update the backup recommendations asynchronously.
      updateBackupRecommendations(user);
      return res.status(200).json(orderedPosts);
    } else {
      // If recommendedPosts already exists and has at least 10 posts,
      // return the first 30 posts from recommendedPosts.
      console.log("Returning stored recommended posts.");
      const recommendedSlice = user.recommendedPosts.slice(0, 30);
      // Convert recommendedSlice IDs from strings to ObjectId.
      const convertedRecommendedSlice = recommendedSlice.map(id => ObjectId(id));
      const posts = await Post.find(
        { _id: { $in: convertedRecommendedSlice } },
        { _id: 1, imageUrl: 1, title: 1, price: 1, description: 1 }
      );
      const postsMap = {};
      posts.forEach(post => {
        postsMap[post._id.toString()] = post;
      });
      const orderedPosts = recommendedSlice.map(id => postsMap[id]).filter(Boolean);
      
      // Store these returned posts in recentBatch so that they are excluded in the next backup update.
      user.recentBatch = recommendedSlice;
      await user.save();
      // Now, asynchronously update the backup recommendations.
      updateBackupRecommendations(user);
      return res.status(200).json(orderedPosts);
    }
  } catch (error) {
    console.error("Error in GET /posts:", error);
    return res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// Other routes (e.g. /myPosts, /:id) remain unchanged.
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
      imageUrl: post.imageUrl,
      title: post.title,
      uploader: post.uploader,
      price: post.price,
      description: post.description,
      pageUrl: post.pageUrl
    });
  } catch (error) {
    console.error("Error in GET /:id", error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

module.exports = router;
