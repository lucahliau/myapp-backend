// worker.js
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
