// visionWorker.js
require('dotenv').config(); // load environment variables
const mongoose = require('mongoose');
const visionProcessor = require('./visionProcessor'); // adjust path if needed
const Post = require('./models/Post');
const visionQueue = require('./queue');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected for vision worker"))
  .catch(err => {
    console.error("MongoDB connection error (worker):", err);
    process.exit(1);
  });

// Process jobs from the visionQueue.
visionQueue.process(async (job) => {
  const { postId, imageUrl, title, description } = job.data;
  console.log(`Processing vision job for post ${postId}`);

  try {
    // Call your vision processor function.
    // Make sure analyzeImageAndCategorize returns a computed object.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log("Computed attributes for post", postId, ":", computedAttributes);

    // Update the post document with the computed attributes.
    // Assuming your Post schema has an "attributes" field (an object)
    await Post.findByIdAndUpdate(postId, { attributes: computedAttributes });
    console.log(`Post ${postId} updated with computed attributes.`);
    return Promise.resolve();
  } catch (error) {
    console.error(`Error processing vision job for post ${postId}:`, error);
    return Promise.reject(error);
  }
});

// Optional: Listen for job completion and failures.
visionQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed.`);
});

visionQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});
