// jobs/visionJob.js
const agenda = require('../agenda');
const Post = require('../models/Post');
const visionProcessor = require('../visionProcessor'); // Make sure this module exports analyzeImageAndCategorize

// Define the job called "process vision job"
agenda.define('process vision job', async (job, done) => {
  try {
    const { postId, imageUrl, description, title } = job.attrs.data;
    console.log(`Starting vision job for post ${postId}`);

    // Call the vision processor to get computed attributes.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log(`Computed attributes for post ${postId}:`, computedAttributes);

    // Update the post document with the computed attributes.
    await Post.findByIdAndUpdate(postId, { $set: { attributes: computedAttributes } });
    console.log(`Post ${postId} updated with computed attributes.`);

    done(); // Indicate successful completion.
  } catch (error) {
    console.error(`Error processing vision job for post ${job.attrs.data.postId}:`, error);
    done(error); // Signal an error occurred.
  }
});
