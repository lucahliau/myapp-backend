/*
// ProductImporter.js

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


function transformSlugToTitle(slug) {
  if (!slug) return "No title available";

  // Replace underscores with dashes (if needed)
  slug = slug.replace(/_/g, "-");

  // Split the slug on dashes
  let parts = slug.split("-");
  
  // Remove the first element (seller name) if there is more than one part
  if (parts.length > 1) {
    parts.shift();
  }
  
  // Join the remaining parts with spaces
  let title = parts.join(" ");
  
  // Capitalize the first letter of the resulting title
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title;
}

async function importProducts() {
  try {
    const options = {
      method: 'GET',
      url: 'https://depop-thrift.p.rapidapi.com/search?country=us&sort=newlyListed',
      params: {
        // You can add additional query parameters if the API requires them.
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    console.log("API Response:", response.data);

    let products;
    // Determine if the response data is an array or if it's under a key (e.g., results)
    if (Array.isArray(response.data)) {
      products = response.data;
    } else if (response.data.results && Array.isArray(response.data.results)) {
      products = response.data.results;
    } else {
      throw new Error("Unexpected response format: products is not iterable");
    }

    console.log("Products (type and value):", products, Array.isArray(products));

    // Iterate over the products and create posts
    for (const product of products) {
      // Get the image URL from the preview object at size '640' if available; otherwise fallback to a general imageUrl.
      const imageUrl = product.preview && product.preview['640']
        ? product.preview['640']
        : product.imageUrl || "";

      // Create a title by transforming the product slug.
      const title = transformSlugToTitle(product.slug);

      // Determine the description:
      // Use product.description if it exists; otherwise, use a fallback that includes the brand name and country.
      const description = product.description 
        ? product.description 
        : `Brand: ${product.brand_name || "Unknown"}, Country: ${product.country || "Unknown"}`;

      const newPost = new Post({
        imageUrl,
        title,
        description,
        uploader: "api_import"  // Use a fixed uploader identifier for API-imported posts
      });

      await newPost.save();
      console.log(`Imported post for product: ${title}`);
    }

    console.log("Products imported successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error importing products:", error);
    process.exit(1);
  }
}

importProducts();*/
// ProductImporter.js
// ProductImporter.js

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Post = require('./models/Post'); // Adjust the path if necessary

// Connect to MongoDB using your connection string from .env
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected for product import"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/**
 * Helper function to transform a product slug into a title.
 * It replaces underscores with dashes, splits the slug by dashes,
 * removes the first segment (assumed to be the seller's username),
 * joins the rest with spaces, and capitalizes the first letter.
 */
function transformSlugToTitle(slug) {
  if (!slug) return "No title available";

  // Replace underscores with dashes
  slug = slug.replace(/_/g, "-");

  // Split the slug on dashes
  let parts = slug.split("-");

  // Remove the first element (seller name) if there is more than one part
  if (parts.length > 1) {
    parts.shift();
  }
  
  // Join the remaining parts with spaces
  let title = parts.join(" ");

  // Capitalize the first letter of the resulting title
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title;
}

/**
 * Helper function to categorize the price.
 * Returns a string based on the following brackets: 
 * "0-10", "10-40", "40-100", "100-200", "200-300", "300+"
 */
function categorizePrice(price) {
  if (price < 10) return "0-10";
  else if (price < 40) return "10-40";
  else if (price < 100) return "40-100";
  else if (price < 200) return "100-200";
  else if (price < 300) return "200-300";
  else return "300+";
}

async function importProducts() {
  try {
    const options = {
      method: 'GET',
      url: 'https://depop-thrift.p.rapidapi.com/search?country=us&sort=newlyListed',
      params: {
        // Add any additional query parameters if needed.
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    console.log("API Response:", response.data);

    let products;
    // Determine if the response data is an array or if it's under a key (e.g., results)
    if (Array.isArray(response.data)) {
      products = response.data;
    } else if (response.data.results && Array.isArray(response.data.results)) {
      products = response.data.results;
    } else {
      throw new Error("Unexpected response format: products is not iterable");
    }

    console.log("Products (type and value):", products, Array.isArray(products));

    // Iterate over the products and create posts
    for (const product of products) {
      // Get the image URL from the preview object at size '640' if available; otherwise fallback.
      const imageUrl = product.preview && product.preview['640']
        ? product.preview['640']
        : product.imageUrl || "";

      // Create a title by transforming the product slug.
      const title = transformSlugToTitle(product.slug);

      // Determine the description: if the product has a description field, use it.
      // Otherwise, create a fallback using brand name and country.
      const description = product.description
        ? product.description
        : `Brand: ${product.brand_name || "Unknown"}, Country: ${product.country || "Unknown"}`;

      // Get the price (if the API provides it); otherwise, default to 0.
      const price = product.price ? Number(product.price) : 0;
      const priceRange = categorizePrice(price);

      // Create a new post document with the new fields.
      const newPost = new Post({
        imageUrl,
        linkUrl: "https://www.depop.com", // Default product URL; adjust if needed.
        title,
        description,
        uploader: "api_import", // Use a fixed uploader identifier for API-imported posts.
        price,
        priceRange
        // (If you later add fields for each adjective from your visionProcessor output, add them here.)
      });

      await newPost.save();
      console.log(`Imported post for product: ${title}`);
    }

    console.log("Products imported successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error importing products:", error);
    process.exit(1);
  }
}

importProducts();
