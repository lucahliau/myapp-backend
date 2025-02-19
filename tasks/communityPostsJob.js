/*// tasks/communityPostsJob.js
const cron = require('node-cron');
const User = require('../models/User');
const Post = require('../models/Post');
const CommunityPost = require('../models/CommunityPost');

/**
 * This function:
 *  - Retrieves all users.
 *  - Tallies likedPosts (assumed to be an array of Post ObjectIds on each user).
 *  - Sorts the post IDs by like count (descending) and takes the top 20.
 *  - Deletes any posts in the communityPosts collection.
 *  - Inserts the full post documents into the communityPosts collection,
 *    each with an assigned orderPosition (1 = most popular, 2 = second, etc.).
 */
async function updateCommunityPosts() {
  try {
    console.log("Running community posts update job...");

    // Retrieve all users.
    const users = await User.find({});
    const likeCountMap = {};

    // Tally likedPosts for each user.
    users.forEach(user => {
      if (user.likedPosts && Array.isArray(user.likedPosts)) {
        user.likedPosts.forEach(postId => {
          const idStr = postId.toString();
          likeCountMap[idStr] = (likeCountMap[idStr] || 0) + 1;
        });
      }
    });

    // Create an array of [postId, count] pairs, sort descending by count, and take the top 20.
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
    const topPostsDocs = await Post.find({ _id: { $in: sortedPosts } });

    // Create a new array with the orderPosition added, using the order of sortedPosts.
    const postsWithOrder = sortedPosts.map((postId, index) => {
      // Find the post document that matches this id.
      const post = topPostsDocs.find(p => p._id.toString() === postId);
      if (post) {
        // Convert to a plain object and add the orderPosition field.
        const postObj = post.toObject();
        postObj.orderPosition = index + 1; // 1 for the top post, 2 for the next, etc.
        return postObj;
      }
    }).filter(Boolean); // Remove any undefined entries

    // Insert the posts (with orderPosition) into the communityPosts collection.
    await CommunityPost.insertMany(postsWithOrder);
    console.log("Community posts updated successfully.");
  } catch (error) {
    console.error("Error updating community posts:", error);
  }
}

// Schedule the job to run every day at midnight EST.
cron.schedule('0 0 * * *', () => {
  console.log("Scheduled job triggered at midnight EST");
  updateCommunityPosts();
}, {
  timezone: "America/New_York"
});

// Export the function so it can be called on server startup.
module.exports = updateCommunityPosts;
*/
// tasks/communityPostsJob.js
const cron = require('node-cron');
const User = require('../models/User');
const Post = require('../models/Post');
const CommunityPost = require('../models/CommunityPost');

/**
 * This function:
 *  - Retrieves all users.
 *  - Tallies likedPosts (weight 1 each) and favouritePosts (weight 3 each) on each user.
 *  - Sorts the post IDs by the weighted like count (descending) and takes the top 20.
 *  - Deletes any posts in the communityPosts collection.
 *  - Inserts the full post documents into the communityPosts collection,
 *    each with an assigned orderPosition (1 = most popular, 2 = second, etc.).
 */
async function updateCommunityPosts() {
  try {
    console.log("Running community posts update job...");

    // Retrieve all users.
    const users = await User.find({});
    const likeCountMap = {};

    // Tally likedPosts and favouritePosts for each user.
    users.forEach(user => {
      // Add weight 1 for each liked post.
      if (user.likedPosts && Array.isArray(user.likedPosts)) {
        user.likedPosts.forEach(postId => {
          const idStr = postId.toString();
          likeCountMap[idStr] = (likeCountMap[idStr] || 0) + 1;
        });
      }
      // Add weight 3 for each favourite post.
      if (user.favouritePosts && Array.isArray(user.favouritePosts)) {
        user.favouritePosts.forEach(postId => {
          const idStr = postId.toString();
          likeCountMap[idStr] = (likeCountMap[idStr] || 0) + 3;
        });
      }
    });

    // Create an array of [postId, count] pairs, sort descending by count, and take the top 20.
    const sortedPosts = Object.entries(likeCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(entry => entry[0]);

    console.log("Top post IDs by weighted like count: ", sortedPosts);

    // Delete all existing documents in the communityPosts collection.
    await CommunityPost.deleteMany({});

    if (sortedPosts.length === 0) {
      console.log("No liked posts found. Community posts collection remains empty.");
      return;
    }

    // Retrieve the full Post documents corresponding to these IDs.
    const topPostsDocs = await Post.find({ _id: { $in: sortedPosts } });

    // Create a new array with the orderPosition added, using the order of sortedPosts.
    const postsWithOrder = sortedPosts.map((postId, index) => {
      // Find the post document that matches this id.
      const post = topPostsDocs.find(p => p._id.toString() === postId);
      if (post) {
        // Convert to a plain object and add the orderPosition field.
        const postObj = post.toObject();
        postObj.orderPosition = index + 1; // 1 for the top post, 2 for the next, etc.
        return postObj;
      }
    }).filter(Boolean); // Remove any undefined entries

    // Insert the posts (with orderPosition) into the communityPosts collection.
    await CommunityPost.insertMany(postsWithOrder);
    console.log("Community posts updated successfully.");
  } catch (error) {
    console.error("Error updating community posts:", error);
  }
}

// Schedule the job to run every day at midnight EST.
cron.schedule('0 0 * * *', () => {
  console.log("Scheduled job triggered at midnight EST");
  updateCommunityPosts();
}, {
  timezone: "America/New_York"
});

// Export the function so it can be called on server startup.
module.exports = updateCommunityPosts;
