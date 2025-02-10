// deleteAllPosts.js

require('dotenv').config();  // Ensure you have a .env file with MONGO_URI defined
const mongoose = require('mongoose');
const Post = require('./models/Post'); // Adjust the path if your Post model is located elsewhere

// Connect to MongoDB using the connection string in your .env file
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("Connected to MongoDB.");

    // Delete all posts from the collection
    const result = await Post.deleteMany({});
    console.log(`${result.deletedCount} posts deleted.`);

    // Close the database connection and exit
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  });
