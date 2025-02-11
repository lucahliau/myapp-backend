// visionWorker.js
const { Worker } = require('bullmq');
const Post = require('./models/Post'); // Adjust the path as needed
const visionProcessor = require('./visionProcessor'); // Ensure this module exports analyzeImageAndCategorize

function getRedisConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set in the environment variables.");
  }
  const redisUrl = new URL(process.env.REDIS_URL);
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port),
    password: redisUrl.password ? redisUrl.password.replace(/^:/, '') : undefined
  };
}

const worker = new Worker(
  'visionQueue',
  async (job) => {
    try {
      const { postId, imageUrl, description, title } = job.data;
      console.log(`Processing vision job for post ${postId}...`);
      
      // Call your vision processor function.
      const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
      console.log("Computed attributes:", computedAttributes);
      
      // Update the Post document with the computed attributes.
      await Post.findByIdAndUpdate(postId, { attributes: computedAttributes });
      
      return computedAttributes;
    } catch (err) {
      console.error("Error processing vision job:", err);
      throw err;
    }
  },
  { connection: getRedisConnection() }
);

// Optional: log job completions and failures.
worker.on("completed", (job, result) => {
  console.log(`Vision job ${job.id} completed with result:`, result);
});
worker.on("failed", (job, err) => {
  console.error(`Vision job ${job.id} failed:`, err);
});

module.exports = worker;
