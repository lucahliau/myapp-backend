// jobs/updateRecommendations.js
const cron = require('node-cron');
const User = require('../models/User');
const Post = require('../models/Post');
const axios = require('axios');

const PYTHON_SERVICE_URL = 'https://recommendation-service-70za.onrender.com';

async function callCalculatePreferences(likedDescriptions, dislikedDescriptions) {
  const payload = { likedDescriptions, dislikedDescriptions };
  const response = await axios.post(`${PYTHON_SERVICE_URL}/calculate_preferences`, payload);
  return response.data;
}

async function callRecommend(likedClusters, dislikedClusters, samplePosts) {
  const payload = { likedClusters, dislikedClusters, posts: samplePosts };
  const response = await axios.post(`${PYTHON_SERVICE_URL}/recommend`, payload);
  let recommendedIds = response.data;
  if (recommendedIds.length && typeof recommendedIds[0] === 'object') {
    recommendedIds = recommendedIds.map(item => item.id);
  }
  return recommendedIds;
}

async function updateUserRecommendations() {
  try {
    // Find all users with at least 30 interactions.
    const users = await User.find().populate('likedPosts dislikedPosts');
    for (const user of users) {
      const likedCount = user.likedPosts ? user.likedPosts.length : 0;
      const dislikedCount = user.dislikedPosts ? user.dislikedPosts.length : 0;
      if ((likedCount + dislikedCount) < 30) {
        continue; // Skip users with fewer than 30 interactions.
      }
      
      // If clusters are missing, calculate them.
      if (!user.likedClusters || !user.dislikedClusters || !user.likedClusters.length || !user.dislikedClusters.length) {
        const likedDescriptions = user.likedPosts.map(post => post["product_description:"]).filter(Boolean);
        const dislikedDescriptions = user.dislikedPosts.map(post => post["product_description:"]).filter(Boolean);
        const clusters = await callCalculatePreferences(likedDescriptions, dislikedDescriptions);
        user.likedClusters = clusters.likedClusters;
        user.dislikedClusters = clusters.dislikedClusters;
      }
      
      // Sample ALL posts (no $sample limit).
      const allPosts = await Post.aggregate([
        { $project: { _id: 1, "image_url:": 1, "title:": 1, "price:": 1, "product_description:": 1 } }
      ]);
      
      // Get recommendations using all posts.
      const recommendedIds = await callRecommend(user.likedClusters, user.dislikedClusters, allPosts);
      
      // Store the top 50 recommended posts.
      user.recommendedPosts = recommendedIds.slice(0, 50);
      await user.save();
      console.log(`Updated recommendations for user ${user._id}`);
    }
  } catch (error) {
    console.error("Error updating recommendations:", error);
  }
}

// Schedule the job to run every hour.
cron.schedule('0 * * * *', () => {
  console.log('Running hourly recommendation update job');
  updateUserRecommendations();
});
