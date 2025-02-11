/*// worker.js
const agenda = require('./agenda');

// Import your job definitions so that Agenda knows about them.
require('./jobs/visionJob');

(async function() {
  // Wait until Agenda connects to the database.
  await agenda.start();
  console.log('Agenda worker started and waiting for jobs...');
  // Optionally, you can schedule a test job here if needed:
  // await agenda.now('process vision job', { postId: '123', imageUrl: 'http://example.com/img.jpg', description: 'example', title: 'example' });
})();
*/

// worker.js
const mongoose = require('mongoose');
const agenda = require('./agenda'); // Your agenda configuration file

// Connect to MongoDB before starting Agenda
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error in worker:', err);
});

mongoose.connection.once('open', () => {
  console.log('MongoDB connected in worker process.');
  // Now that the DB connection is ready, start Agenda.
  agenda.start();
});
