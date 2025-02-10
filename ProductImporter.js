/*
// ProductImporter.js
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Post = require('./models/Post'); // Adjust the path as needed

// Connect to MongoDB using your connection string from .env
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected for product import"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function importNikeProducts() {
  try {
    const options = {
      method: 'GET',
      url: 'https://depop-thrift.p.rapidapi.com/search?country=us&sort=newlyListed', // Replace with the actual endpoint if needed
      params: {
        // Include any required query parameters here
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    console.log("API Response:", response.data);

    let products;

    if (Array.isArray(response.data)) {
      products = response.data;
    } else if (response.data.results && Array.isArray(response.data.results)) {
      products = response.data.results;
    } else {
      throw new Error("Unexpected response format: products is not iterable");
    }

    console.log("Products (type and value):", products, Array.isArray(products));

    // Iterate over the products and create posts
    // Inside your for-loop over the products:
for (const product of products) {
  // Use the 'preview' field's '640' size image if available; otherwise fallback to a general imageUrl.
  const imageUrl = product.preview && product.preview['640']
    ? product.preview['640']
    : product.imageUrl || "";
  
  // Transform the product slug to a title:
  const title = transformSlugToTitle(product.slug);

  const newPost = new Post({
    imageUrl,
    text: title,
    uploader: "api_import"  // Use a fixed uploader identifier for API-imported posts
  });

  await newPost.save();
  console.log(`Imported post for product: ${title}`);
}


    console.log("Nike products imported successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error importing products:", error);
    process.exit(1);
  }
}
function transformSlugToTitle(slug) {
  if (!slug) return "No description available";

  // Replace underscores with dashes if needed (optional)
  slug = slug.replace(/_/g, "-");

  // Split the slug on dashes
  let parts = slug.split("-");
  
  // Remove the first element (seller name) if there is more than one part
  if (parts.length > 1) {
    parts.shift(); // Remove the first segment (seller name)
  }
  
  // Join the remaining parts with spaces
  let title = parts.join(" ");
  
  // Optionally, capitalize the first letter of the resulting title
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title;
}



importNikeProducts();*/


// ProductImporter.js
/*
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Post = require('./models/Post'); // adjust the path as needed

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected for product import"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

function transformSlugToTitle(slug) {
  if (!slug) return "No title available";
  slug = slug.replace(/_/g, "-");
  let parts = slug.split("-");
  if (parts.length > 1) {
    parts.shift();
  }
  let title = parts.join(" ");
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  return title;
}

async function importProducts() {
  try {
    const options = {
      method: 'GET',
      //url: 'https://depop-thrift.p.rapidapi.com/search',
      url: 'https://depop-thrift.p.rapidapi.com/search?country=us&sort=newlyListed',
      params: {
        country: 'us',
        sort: 'newlyListed'
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    console.log("API Response:", response.data);

    // Assume the response is an array; adjust if necessary.
    const products = Array.isArray(response.data) ? response.data : response.data.results;
    if (!products || !Array.isArray(products)) {
      throw new Error("Products data is not iterable");
    }

    for (const product of products) {
      // Use preview image from '640' if available.
      const imageUrl = product.preview && product.preview['640']
        ? product.preview['640']
        : product.imageUrl || "";

      // Use the slug to generate a title.
      const title = transformSlugToTitle(product.slug);

      // Use product.description if available, otherwise set a default.
      // (Check the API documentation—if a description field exists, use it.)
      const description = product.description || "No description available";

      const newPost = new Post({
        imageUrl,
        title,
        description,
        uploader: "api_import"
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
*/
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

/**
 * Helper function to transform a product slug into a title.
 * It replaces underscores with dashes, splits the slug by dashes,
 * removes the first segment (assumed to be the seller name),
 * joins the rest with spaces, and capitalizes the first letter.
 */
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

importProducts();
