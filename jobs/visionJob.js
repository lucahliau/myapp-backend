// jobs/visionJob.js
const agenda = require('../agenda'); // adjust the path if needed
const visionProcessor = require('../visionProcessor'); // your module that exports analyzeImageAndCategorize
const Post = require('../models/Post');

// Define the job. We call it "process vision job".
agenda.define('process vision job', async (job) => {
  const { postId, imageUrl, description, title } = job.attrs.data;
  console.log(`Starting vision job for post ${postId}`);
  try {
    // Call your vision processor function.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log(`Computed attributes for post ${postId}:`, computedAttributes);

    // Update the post document with the computed attributes.
    await Post.findByIdAndUpdate(postId, { $set: { attributes: computedAttributes } });
    console.log(`Vision job for post ${postId} completed successfully.`);
  } catch (error) {
    console.error(`Error processing vision job for post ${postId}:`, error);
    throw error;
  }
});
