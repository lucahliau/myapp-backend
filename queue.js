// flowQueue.js
const { FlowProducer } = require('bullmq');

function getRedisConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not set in the environment variables.");
  }
  const redisUrl = new URL(process.env.REDIS_URL);
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port),
    // Sometimes the password in the URL starts with a colon—strip it if so.
    password: redisUrl.password ? redisUrl.password.replace(/^:/, '') : undefined
  };
}

const flowProducer = new FlowProducer({
  connection: getRedisConnection()
});

module.exports = flowProducer;
