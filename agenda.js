// agenda.js
const { Agenda } = require('agenda');

const mongoConnectionString = process.env.MONGO_URI; // Your MongoDB URI from .env

const agenda = new Agenda({
  db: { address: mongoConnectionString, collection: 'agendaJobs' },
  // Optionally you can set default concurrency or lockLifetime:
  // defaultConcurrency: 5,
  // lockLifetime: 10000,
});

module.exports = agenda;
