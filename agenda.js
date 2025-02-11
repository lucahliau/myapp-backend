// agenda.js
const Agenda = require('agenda');

const mongoConnectionString = process.env.MONGO_URI; // Ensure this is defined in your environment

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'agendaJobs' },
  // Optionally, you can adjust the polling interval:
  processEvery: '30 seconds',
});

// Export the agenda instance so it can be used in both the web and worker processes.
module.exports = agenda;
