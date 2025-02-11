/*// visionWorker.js
const visionQueue = require('./queue');
const Post = require('./models/Post');          // Adjust the path as needed
const visionProcessor = require('./visionProcessor'); // This module must export analyzeImageAndCategorize

// Process jobs from the vision queue.
visionQueue.process(async (job, done) => {
  try {
    // Expecting the job data to include the postId and the fields needed for vision.
    const { postId, imageUrl, description, title } = job.data;
    console.log(`Processing vision job for post ${postId}...`);
    
    // Call your vision processing function.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes:", computedAttributes);
    
    // Update the Post document with the computed attributes.
    await Post.findByIdAndUpdate(postId, { attributes: computedAttributes });
    
    done(null, computedAttributes);
  } catch (error) {
    console.error('Error processing vision job:', error);
    done(error);
  }
});

// Optionally log completed and failed jobs.
visionQueue.on('completed', (job, result) => {
  console.log(`Vision job ${job.id} completed. Result:`, result);
});
visionQueue.on('failed', (job, err) => {
  console.error(`Vision job ${job.id} failed:`, err);
});
*/
// visionWorker.js
const { Worker } = require('bullmq');
const Post = require('./models/Post');              // adjust the path if needed
const visionProcessor = require('./visionProcessor'); // ensure this module exports analyzeImageAndCategorize

// Use the same connection options as in flowQueue.js:
const connection = (() => {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port),
      password: url.password ? url.password.slice(1) : undefined,
    };
  }
  return { host: '127.0.0.1', port: 6379 };
})();

// Create a Worker that processes jobs from the "visionQueue".
const visionWorker = new Worker(
  'visionQueue',
  async (job) => {
    try {
      const { postId, imageUrl, description, title } = job.data;
      console.log(`Processing vision job for post ${postId}...`);

      // Run your vision processing function
      const computedAttributes = await visionProcessor.analyzeImageAndCategorize(
        imageUrl,
        description,
        title
      );
      console.log("Computed attributes:", computedAttributes);

      // Update the Post document with the computed attributes.
      await Post.findByIdAndUpdate(postId, { attributes: computedAttributes });
      return computedAttributes;
    } catch (error) {
      console.error("Error in vision worker:", error);
      throw error;
    }
  },
  { connection }
);

// Optional logging for job completions and failures.
visionWorker.on("completed", (job, result) => {
  console.log(`Vision job ${job.id} completed with result:`, result);
});
visionWorker.on("failed", (job, err) => {
  console.error(`Vision job ${job.id} failed:`, err);
});

module.exports = visionWorker;
