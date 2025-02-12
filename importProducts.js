// importProducts.js

require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Import the uuid package

// Connect to MongoDB using your connection string from your .env file.
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define a Mongoose schema with strict:false so that any key is allowed.
const postSchema = new mongoose.Schema({}, { strict: false });
const Post = mongoose.model('Post', postSchema);

// Array to hold all CSV rows.
const products = [];

// Read the CSV file. Adjust the filename if needed.
fs.createReadStream('grailed_products_with_embeddings.csv')
  .pipe(csv())
  .on('data', (data) => {
    // Each row is an object with keys from your CSV headers.
    products.push(data);
  })
  .on('end', async () => {
    console.log(`Parsed ${products.length} products.`);
    
    // Iterate over each row
    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      
      // Remove the CSV's existing id (if present)
      if (row.id) {
        delete row.id;
      }
      
      // Generate a new UUID and assign it to product_id.
      row.product_id = uuidv4();
      
      try {
        // Create a new Post document using the updated row.
        const newPost = new Post(row);
        await newPost.save();
        console.log(`Saved product ${i + 1}: ${row['title:'] || row.title || 'No Title'}`);
      } catch (err) {
        console.error(`Error saving product ${i + 1}:`, err);
      }
    }
    
    console.log('All products imported successfully.');
    mongoose.disconnect();
    process.exit(0);
  });
