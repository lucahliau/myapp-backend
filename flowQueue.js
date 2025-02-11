// flowQueue.js
const { FlowProducer } = require('bullmq');

// Heroku Redis typically gives you REDIS_URL; if not, you can parse it or supply defaults.
const connection = (() => {
  if (process.env.REDIS_URL) {
    // For example, if REDIS_URL is in the form "redis://:password@host:port"
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port),
      password: url.password ? url.password.slice(1) : undefined, // remove leading colon if any
    };
  }
  // fallback to localhost (useful for local development)
  return { host: '127.0.0.1', port: 6379 };
})();

const flowProducer = new FlowProducer({ connection });

module.exports = flowProducer;
