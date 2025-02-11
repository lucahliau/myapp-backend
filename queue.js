// queue.js
const Queue = require('bull');

// Use the REDIS_URL provided by Heroku if available
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Create a new queue named "vision-processing"
const visionQueue = new Queue('vision-processing', redisUrl);

// (Optional) Set up basic error handling or logging
visionQueue.on('error', (error) => {
  console.error('Bull Queue error:', error);
});

module.exports = visionQueue;
