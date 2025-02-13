const fs = require('fs');
const path = require('path');

// Define the uploads folder path relative to your project root
const uploadsDir = path.join(__dirname, 'uploads');

// Check if the folder exists; if not, create it
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}




// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 10000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

  //added (usually after your middleware setup, before your test route) step 11B
// Require auth routes and add them to your app
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

//12B
const postRoutes = require('./routes/posts');
app.use('/api/posts', postRoutes);

//13B
const interactionRoutes = require('./routes/interactions');
app.use('/api/interactions', interactionRoutes);

//photos convert
app.use('/uploads', express.static('uploads'));




// A simple test route
app.get('/', (req, res) => {
  res.send('Backend server is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
