// visionWorker.js
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
