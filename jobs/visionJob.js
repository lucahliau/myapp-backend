// jobs/visionJob.js
/*
const agenda = require('../agenda');
const Post = require('../models/Post');
const visionProcessor = require('../visionProcessor'); // Make sure this module exports analyzeImageAndCategorize

// Define the job called "process vision job"
agenda.define('process vision job', async (job, done) => {
  try {
    const { postId, imageUrl, description, title } = job.attrs.data;
    console.log(`Starting vision job for post ${postId}`);

    // Call the vision processor to get computed attributes.
    const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
    console.log(`Computed attributes for post ${postId}:`, computedAttributes);



    
    // Update the post document with the computed attributes.
    await Post.findByIdAndUpdate(postId, { $set: { attributes: computedAttributes } });
    console.log(`Post ${postId} updated with computed attributes.`);

    done(); // Indicate successful completion.
  } catch (error) {
    console.error(`Error processing vision job for post ${job.attrs.data.postId}:`, error);
    done(error); // Signal an error occurred.
  }
});

*/
// jobs/visionJob.js
const agenda = require('../agenda');
const Post = require('../models/Post');
const visionProcessor = require('../visionProcessor'); // This module should export analyzeImageAndCategorize()

// A default object containing every attribute with an initial value of 0.
const defaultAttributes = {
  // Color:
  Red: 0,
  Orange: 0,
  Yellow: 0,
  Gold: 0,
  Olive: 0,
  Green: 0,
  Teal: 0,
  Cyan: 0,
  "Sky Blue": 0,
  Blue: 0,
  Navy: 0,
  Indigo: 0,
  Purple: 0,
  Lavender: 0,
  Magenta: 0,
  Pink: 0,
  Brown: 0,
  Gray: 0,
  // Material:
  Cotton: 0,
  Linen: 0,
  Wool: 0,
  Cashmere: 0,
  Silk: 0,
  Satin: 0,
  Rayon: 0,
  Polyester: 0,
  Acrylic: 0,
  Nylon: 0,
  Spandex: 0,
  Denim: 0,
  Corduroy: 0,
  Tweed: 0,
  Leather: 0,
  Suede: 0,
  Fleece: 0,
  Velvet: 0,
  Jersey: 0,
  // Clothing Item Type:
  "T-shirt": 0,
  Polo: 0,
  boots: 0,
  shoes: 0,
  "Button-down Shirt": 0,
  Blouse: 0,
  "Tank Top": 0,
  Sweater: 0,
  Hoodie: 0,
  Jacket: 0,
  Blazer: 0,
  Coat: 0,
  Jeans: 0,
  Trousers: 0,
  Shorts: 0,
  Skirt: 0,
  Dress: 0,
  Jumpsuit: 0,
  Leggings: 0,
  accessories: 0,
  Swimsuit: 0,
  // Era:
  "1920s": 0,
  "1930s": 0,
  "1940s": 0,
  "1950s": 0,
  "1960s": 0,
  "1970s": 0,
  "1980s": 0,
  "1990s": 0,
  "2000s": 0,
  "2010s": 0,
  "2020s": 0,
  Futuristic: 0,
  Cyberpunk: 0,
  // Gender:
  "Men's": 0,
  "Women's": 0,
  Unisex: 0,
  // Season:
  Winter: 0,
  Spring: 0,
  Summer: 0,
  Fall: 0,
  // Pattern:
  Solid: 0,
  Striped: 0,
  Plaid: 0,
  Checkered: 0,
  "Polka Dot": 0,
  Floral: 0,
  Paisley: 0,
  Houndstooth: 0,
  Herringbone: 0,
  Geometric: 0,
  Camouflage: 0,
  "Animal Print": 0,
  "Tie-Dye": 0,
  Gradient: 0,
  Abstract: 0,
  // Country/World Region:
  USA: 0,
  UK: 0,
  France: 0,
  Italy: 0,
  Spain: 0,
  Germany: 0,
  Scandinavia: 0,
  Japan: 0,
  China: 0,
  India: 0,
  "Middle East": 0,
  Africa: 0,
  "South America": 0,
  Australia: 0,
  "Eastern Europe": 0,
  Russia: 0,
  // Embellishments:
  Embroidery: 0,
  Sequins: 0,
  Lace: 0,
  Beads: 0,
  Studs: 0,
  Rhinestones: 0,
  Fringe: 0,
  Tassels: 0,
  Pearls: 0,
  Feathers: 0,
  Bows: 0,
  Buttons: 0,
  Patches: 0,
  "Metal Chains": 0,
  Zippers: 0,
  Cutouts: 0,
  "Fur Trim": 0,
  // Style:
  luxury: 0,
  formal: 0,
  minimalist: 0,
  plain: 0,
  preppy: 0,
  "Business Casual": 0,
  casual: 0,
  Streetwear: 0,
  grunge: 0,
  punk: 0,
  goth: 0,
  vintage: 0,
  Y2K: 0,
  Athleisure: 0,
  sport: 0,
  western: 0
};


  // Define the job with Agenda
  agenda.define('process vision job', async job => {
    const { postId, imageUrl, description, title } = job.attrs.data;
    console.log(`Starting vision job for post ${postId}`);
    try {
      // Call your vision processor to get computed attribute scores.
      const computedAttributes = await visionProcessor.analyzeImageAndCategorize(imageUrl, description, title);
      console.log("Computed attributes:", computedAttributes);
      const mergedAttributes = { ...defaultAttributes };

      // Iterate over each category in the computed attributes.
      // For each category, if there is a detailedScores object, copy its key-value pairs.
      for (const category in computedAttributes) {
        if (
          computedAttributes[category] &&
          computedAttributes[category].detailedScores &&
          typeof computedAttributes[category].detailedScores === 'object'
        ) {
          const scores = computedAttributes[category].detailedScores;
          for (const key in scores) {
            // Only update keys that exist in our defaultAttributes.
            if (mergedAttributes.hasOwnProperty(key)) {
              mergedAttributes[key] = scores[key];
            }
          }
        }
      }
      
      console.log("merged attributes:", mergedAttributes);
      // Update the post so that the 'attributes' field is set to the merged object.
      const updatedPost = await Post.findOneAndUpdate(
        { _id: postId },
        { $set: { attributes: mergedAttributes } },
        { new: true }
      );
      console.log(`Post ${postId} updated with computed attributes.`);
    } catch (error) {
      console.error(`Error processing vision job for post ${postId}:`, error);
      throw error;
    }
  });



