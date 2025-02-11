// queue.js
const Queue = require('bull');

// Use the REDIS_URL from environment variables; if not set, fallback to localhost.
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const visionQueue = new Queue('visionQueue', redisUrl);

// Optional: add some logging for errors.
visionQueue.on('error', (error) => {
  console.error('Vision Queue error:', error);
});

module.exports = visionQueue;
