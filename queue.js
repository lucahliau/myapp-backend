// worker.js
require('dotenv').config();
const Bull = require('bull');
const mongoose = require('mongoose');
const Post = require('./models/Post');
const visionProcessor = require('./visionProcessor');

// Connect to MongoDB.
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected in worker"))
  .catch(err => {
    console.error("MongoDB connection error in worker:", err);
    process.exit(1);
  });

// Create a Bull queue with extra Redis options.
const visionQueue = new Bull('visionQueue', {
  redis: {
    // Use the provided REDIS_URL if available.
    url: process.env.REDIS_URL,
    // Retry strategy: wait longer each time, up to a maximum delay.
    retryStrategy: (times) => {
      // For example, wait 100ms × times, capped at 3000ms.
      return Math.min(times * 100, 3000);
    },
    // Allow unlimited retries per request.
    maxRetriesPerRequest: null,
    // Set a generous connect timeout (in milliseconds).
    connectTimeout: 10000,
  }
});

// Attach error handlers to log any connection issues.
visionQueue.on('error', (err) => {
  console.error("Bull Queue error:", err);
});

// Process jobs from the vision queue.
visionQueue.process(async (job, done) => {
  try {
    const { imageUrl, description, title, postId } = job.data;
    console.log(`Processing job for post ${postId}...`);

    // Call your vision processor function.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes:", computedAttributes);

    // Update the corresponding Post document.
    await Post.findByIdAndUpdate(postId, { attributes: computedAttributes });
    console.log(`Post ${postId} updated with computed attributes.`);
    done();
  } catch (err) {
    console.error("Error processing job in worker:", err);
    done(err);
  }
});

// For debugging, log when jobs fail.
visionQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});

// Keep the worker process running.
console.log("Worker is listening for jobs...");
