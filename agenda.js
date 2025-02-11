// agenda.js
const { Agenda } = require('agenda');
const mongoConnectionString = process.env.MONGO_URI;

// Create and initialize the Agenda instance.
const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'agendaJobs' },
  processEvery: '10 seconds',
  defaultLockLifetime: 10000,
});

// (Optional) Attach event listeners to log job activity.
agenda.on('start', (job) => {
  console.log(`Job ${job.attrs.name} started at ${new Date().toISOString()}`);
});
agenda.on('complete', (job) => {
  console.log(`Job ${job.attrs.name} completed at ${new Date().toISOString()}`);
});
agenda.on('fail', (err, job) => {
  console.error(`Job ${job.attrs.name} failed: ${err.message}`);
});

// Export the agenda instance after it’s defined.
module.exports = agenda;
