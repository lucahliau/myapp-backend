// productImporter.js
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Post = require('./models/Post'); // Adjust the path if necessary

// Connect to MongoDB using your connection string from .env
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected for product import"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Function to fetch Nike products from RapidAPI and create posts
async function importNikeProducts() {
  try {
    const options = {
      method: 'GET',
      url: 'https://depop-thrift.p.rapidapi.com/search?country=us&sort=newlyListed', // Replace with the correct endpoint from the API documentation
      params: {
        // Include any required query parameters here, for example:
        // limit: "20"
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    // Assume the API returns a JSON object with a key "products" that is an array of products.
    const products = response.data.products;

    // Iterate over the products and create posts
    for (const product of products) {
      // Map the product data to your Post model.
      // You might need to adjust the property names depending on the API response.
      const newPost = new Post({
        imageUrl: product.imageUrl,        // For example, product.imageUrl
        text: product.description || product.title, // Use description or title as appropriate
        uploader: "api_import"             // For a proof-of-concept, you might use a fixed uploader identifier
      });

      await newPost.save();
      console.log(`Imported post for product: ${product.title}`);
    }

    console.log("Nike products imported successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error importing products:", error);
    process.exit(1);
  }
}

importNikeProducts();
