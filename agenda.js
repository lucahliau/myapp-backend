module.exports = agenda;

// agenda.js or in your main file where you set up Agenda
const { Agenda } = require('agenda');
const mongoConnectionString = process.env.MONGO_URI;

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'agendaJobs' },
  processEvery: '5 seconds',
  defaultLockLifetime: 10000
});

// Attach listeners for key events.
agenda.on('start', (job) => {
  console.log(`Job ${job.attrs.name} (ID: ${job.attrs._id}) started at ${new Date().toISOString()}`);
});

agenda.on('complete', (job) => {
  console.log(`Job ${job.attrs.name} (ID: ${job.attrs._id}) completed at ${new Date().toISOString()}`);
});

agenda.on('fail', (err, job) => {
  console.error(`Job ${job.attrs.name} (ID: ${job.attrs._id}) failed: ${err.message}`);
});

agenda.on('error', (error) => {
  console.error('Agenda encountered an error:', error);
});

// When ready, start processing.
agenda.on('ready', () => {
  console.log('Agenda is ready and processing jobs.');
  agenda.start();
});

module.exports = agenda;
