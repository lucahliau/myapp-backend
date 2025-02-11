// worker.js
const mongoose = require('mongoose');
const agenda = require('./agenda');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error in worker:', err);
});

mongoose.connection.once('open', () => {
  console.log('MongoDB connected in worker process.');
  
  // Import your job definitions so Agenda knows what jobs to process.
  require('./jobs/visionJob');

  // Start Agenda – this will begin processing any enqueued jobs.
  agenda.start()
    .then(() => {
      console.log('Agenda started and ready to process jobs.');
    })
    .catch((err) => {
      console.error('Error starting Agenda:', err);
    });
});
