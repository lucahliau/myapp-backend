// tasks/communityPostsJob.js
const cron = require('node-cron');
const User = require('../models/User');
const Post = require('../models/Post');
const CommunityPost = require('../models/CommunityPost');

/**
 * This function:
 *  - Retrieves all users.
 *  - Tallies likedPosts (assumed to be an array of Post ObjectIds on each user).
 *  - Sorts the post IDs by like count (descending) and takes the top 20.
 *  - Clears the communityPosts collection and inserts the full post documents
 *    corresponding to the top post IDs.
 */
async function updateCommunityPosts() {
  try {
    console.log("Running community posts update job...");

    // Retrieve all users.
    const users = await User.find({});
    const likeCountMap = {};

    // For each user, tally likedPosts.
    users.forEach(user => {
      // Assuming each user document has a likedPosts array (of ObjectIds)
      if (user.likedPosts && Array.isArray(user.likedPosts)) {
        user.likedPosts.forEach(postId => {
          const idStr = postId.toString();
          likeCountMap[idStr] = (likeCountMap[idStr] || 0) + 1;
        });
      }
    });

    // Create an array of [postId, count] pairs, sort descending by count,
    // then take the top 20 (or fewer if there are not 20 liked posts).
    const sortedPosts = Object.entries(likeCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(entry => entry[0]);

    console.log("Top post IDs by like count: ", sortedPosts);

    // Delete all existing documents in the communityPosts collection.
    await CommunityPost.deleteMany({});

    if (sortedPosts.length === 0) {
      console.log("No liked posts found. Community posts collection remains empty.");
      return;
    }

    // Retrieve the full Post documents corresponding to these IDs.
    let topPosts = await Post.find({ _id: { $in: sortedPosts } });

    // Optional: sort the retrieved posts in the same order as sortedPosts.
    topPosts = sortedPosts
      .map(id => topPosts.find(post => post._id.toString() === id))
      .filter(post => post); // remove any undefined in case a post wasn't found

    // Insert the top posts into the communityPosts collection.
    await CommunityPost.insertMany(topPosts);
    console.log("Community posts updated successfully.");
  } catch (error) {
    console.error("Error updating community posts:", error);
  }
}

// Schedule the job to run every day at midnight EST.
// Cron expression: '0 0 * * *' means minute 0, hour 0, every day.
// The timezone option ensures midnight in the "America/New_York" timezone.
cron.schedule('0 0 * * *', () => {
  console.log("Scheduled job triggered at midnight EST");
  updateCommunityPosts();
}, {
  timezone: "America/New_York"
});

// Export the function so that it can be called on server startup.
module.exports = updateCommunityPosts;
