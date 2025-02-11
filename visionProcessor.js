
// visionProcessor.js

// 1. Import required modules.
const vision = require('@google-cloud/vision');
const tf = require('@tensorflow/tfjs'); // Note: tfjs will use the CPU backend unless you install tfjs-node
const use = require('@tensorflow-models/universal-sentence-encoder');

// 2. Create a Google Cloud Vision API client.
const client = new vision.ImageAnnotatorClient();

// 3. Model-loading (cached)
let model;
async function loadModel() {
  if (!model) {
    model = await use.load();
  }
  return model;
}

// 4. Helper functions

// Normalization map for manual (exact) matching. (All keys will be lowercased.)
const normalizationMap = {
  "grey": "gray",
  "woolen": "wool",
  "navy blue": "navy",
  "blue navy": "navy",
  "active": "sport",
  "athletic": "sport",
  "sports": "sport",
  "rose": "pink",
  "shoe": "shoes",
  "boot": "boots",
  "us": "usa"
  // Add more mappings as needed.
};

function normalizeLabel(label) {
  const lower = label.toLowerCase().trim();
  return (normalizationMap[lower] || lower).toLowerCase();
}

// Banned labels (all lowercased)
const bannedLabels = ["abacus", "textile"]; // adjust as needed

// Cosine similarity between two 1-D tensors.
function cosineSimilarity(tensorA, tensorB) {
  const dotProduct = tensorA.dot(tensorB);
  const normA = tensorA.norm();
  const normB = tensorB.norm();
  return dotProduct.div(normA.mul(normB)).dataSync()[0];
}

// Price categorization helper (if needed later).
function categorizePrice(price) {
  if (price < 10) return "0-10";
  else if (price < 40) return "10-40";
  else if (price < 100) return "40-100";
  else if (price < 200) return "100-200";
  else if (price < 300) return "200-300";
  else return "300+";
}

// 5. Attributes dictionary (note: "Neutral" is removed now).
const attributesDictionary = {
  Color: ['Red', 'Orange', 'Yellow', 'Gold', 'Olive', 'Green', 'Teal', 'Cyan', 'Sky Blue', 'Blue', 'Navy', 'Indigo', 'Purple', 'Lavender', 'Magenta', 'Pink', 'Brown', 'Gray'],
  Material: ['Cotton', 'Linen', 'Wool', 'Cashmere', 'Silk', 'Satin', 'Rayon', 'Polyester', 'Acrylic', 'Nylon', 'Spandex', 'Denim', 'Corduroy', 'Tweed', 'Leather', 'Suede', 'Fleece', 'Velvet', 'Jersey'],
  'Clothing Item Type': ['T-shirt', 'Polo', 'boots', 'shoes', 'Button-down Shirt', 'Blouse', 'Tank Top', 'Sweater', 'Hoodie', 'Jacket', 'Blazer', 'Coat', 'Jeans', 'Trousers', 'Shorts', 'Skirt', 'Dress', 'Jumpsuit', 'Leggings', 'accessories', 'Swimsuit'],
  Era: ['1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'Futuristic', 'Cyberpunk'],
  Gender: ["Men's", "Women's", 'Unisex'],
  Season: ['Winter', 'Spring', 'Summer', 'Fall'],
  Pattern: ['Solid', 'Striped', 'Plaid', 'Checkered', 'Polka Dot', 'Floral', 'Paisley', 'Houndstooth', 'Herringbone', 'Geometric', 'Camouflage', 'Animal Print', 'Tie-Dye', 'Gradient', 'Abstract'],
  'Country/World Region': ['USA', 'UK', 'France', 'Italy', 'Spain', 'Germany', 'Scandinavia', 'Japan', 'China', 'India', 'Middle East', 'Africa', 'South America', 'Australia', 'Eastern Europe', 'Russia'],
  Embellishments: ['Embroidery', 'Sequins', 'Lace', 'Beads', 'Studs', 'Rhinestones', 'Fringe', 'Tassels', 'Pearls', 'Feathers', 'Bows', 'Buttons', 'Patches', 'Metal Chains', 'Zippers', 'Cutouts', 'Fur Trim'],
  Style: ['luxury', 'formal', 'minimalist', 'plain', 'preppy', 'Business Casual', 'casual', 'Streetwear', 'grunge', 'punk', 'goth', 'vintage', 'Y2K', 'Athleisure', 'sport', 'western']
};

// 6. Scoring functions

// 6a. For vision labels
async function scoreCandidatesFromVision(visionLabels, attributeName, dictionary, weight, fixedManual) {
  const candidates = dictionary[attributeName];
  const model = await loadModel();
  // Precompute candidate embeddings.
  const candidateEmbeddingsTensor = await model.embed(candidates);
  let scores = {};
  for (const candidate of candidates) {
    scores[candidate] = 0;
  }

  // First, process direct/manual matches (labels with score ≥ 0.65)
  for (const label of visionLabels) {
    if (label.score < 0.65 || bannedLabels.includes(label.description.toLowerCase())) continue;
    const normLabel = normalizeLabel(label.description);
    for (let candidate of candidates) {
      if (normLabel === candidate.toLowerCase()) {
        // Direct match: assign fixed score multiplied by weight.
        scores[candidate] = Math.max(scores[candidate], fixedManual * weight);
      }
    }
  }

  // Next, for semantic scoring: consider all labels with score ≥ 0.3
  const semanticLabels = visionLabels.filter(label => label.score >= 0.3);
  if (semanticLabels.length > 0) {
    const meanConfidence = semanticLabels.reduce((sum, label) => sum + label.score, 0) / semanticLabels.length;
    // For each semantic label, get its embedding and update scores if not already assigned a fixed manual score.
    for (const label of semanticLabels) {
      const labelEmbeddingTensor = await model.embed([label.description]);
      const labelEmbedding = tf.squeeze(labelEmbeddingTensor);
      for (let i = 0; i < candidates.length; i++) {
        // Only update if the candidate did not get a fixed manual score (i.e. score is still less than fixedManual * weight)
        if (scores[candidates[i]] < fixedManual * weight) {
          const candidateEmbedding = candidateEmbeddingsTensor.slice([i, 0], [1]);
          const candidateEmbedding1D = tf.squeeze(candidateEmbedding);
          const similarity = cosineSimilarity(candidateEmbedding1D, labelEmbedding);
          // Add semantic score weighted by label confidence, the given weight, and the mean confidence factor.
          scores[candidates[i]] += similarity * label.score * weight * meanConfidence;
        }
      }
    }
  }
  return scores;
}

// 6b. For text (description or title)
async function scoreCandidatesFromText(text, attributeName, dictionary, weight, fixedManual) {
  const candidates = dictionary[attributeName];
  let scores = {};
  for (const candidate of candidates) {
    scores[candidate] = 0;
  }
  const model = await loadModel();
  // Tokenize the text by splitting on whitespace and punctuation.
  const tokens = text.toLowerCase().split(/[\s,.;:!?]+/);
  // Manual check: if any token directly matches (after normalization), assign the fixed score.
  for (const candidate of candidates) {
    for (const token of tokens) {
      if (normalizeLabel(token) === candidate.toLowerCase()) {
        scores[candidate] = fixedManual * weight;
        break;
      }
    }
  }
  // For candidates that did not get a manual match, use semantic similarity on the entire text.
  const textEmbeddingTensor = await model.embed([text]);
  const textEmbedding = tf.squeeze(textEmbeddingTensor);
  const candidateEmbeddingsTensor = await model.embed(candidates);
  for (let i = 0; i < candidates.length; i++) {
    if (scores[candidates[i]] === 0) { // no manual match
      const candidateEmbedding = candidateEmbeddingsTensor.slice([i, 0], [1]);
      const candidateEmbedding1D = tf.squeeze(candidateEmbedding);
      const similarity = cosineSimilarity(candidateEmbedding1D, textEmbedding);
      scores[candidates[i]] = similarity * weight;
    }
  }
  return scores;
}

// 7. Combine results from the three sources with weights: vision (1), description (2), title (3).
//    (Fixed manual scores are 50 for vision, 50 for description, and 50 for title now.)
async function combineAllSources(visionLabels, descriptionText, titleText, dictionary) {
  let combined = {};
  for (const attribute in dictionary) {
    const visionScores = await scoreCandidatesFromVision(visionLabels, attribute, dictionary, 1, 50);
    const descriptionScores = await scoreCandidatesFromText(descriptionText, attribute, dictionary, 2, 50);
    const titleScores = await scoreCandidatesFromText(titleText, attribute, dictionary, 3, 50);
    // Sum scores candidate-by-candidate.
    let attributeCombined = {};
    for (const candidate of dictionary[attribute]) {
      attributeCombined[candidate] =
        (visionScores[candidate] || 0) +
        (descriptionScores[candidate] || 0) +
        (titleScores[candidate] || 0);
      // Special handling: if the attribute is Embellishments, divide the final score by 25.
      if (attribute === "Embellishments") {
        attributeCombined[candidate] /= 25;
      }
    }
    // Choose the candidate with the highest total score.
    const sortedCandidates = Object.entries(attributeCombined).sort((a, b) => b[1] - a[1]);
    const [bestCandidate, bestScore] = sortedCandidates[0];
    combined[attribute] = {
      chosen: bestCandidate,
      score: bestScore,
      detailedScores: attributeCombined
    };
  }
  return combined;
}



// 8. Main analysis function that uses the Vision API and then combines all source scores.
async function analyzeImageAndCategorize(imageUrl, description, title) {
  try {
    // Get labels from the Vision API.
    const [result] = await client.labelDetection(imageUrl);
    const visionLabels = result.labelAnnotations;
    console.log('Labels detected:');
    visionLabels.forEach(label => {
      console.log(`${label.description} (score: ${label.score.toFixed(2)})`);
    });

    // Build a basic description string from vision labels (only labels with score ≥ 0.65 and not banned).
    const basicDescription = visionLabels
      .filter(label => label.score >= 0.65 && !bannedLabels.includes(label.description.toLowerCase()))
      .map(label => label.description)
      .join(", ");
    console.log("\nBasic Description (filtered by score ≥ 0.65):");
    console.log(basicDescription);

    // Manual input strings (for demonstration, you might eventually get these from your post upload).
    const manualDescription = description || ""; // set description
    const titleText = title || "";    // set title

    // (For the title, suppose we remove the seller name if present; here we simply use the full title.)
    const normalizedTitle = titleText; // Adjust normalization as needed.
    console.log("\nManual Description:");
    console.log(manualDescription);
    console.log("\nTitle:");
    console.log(normalizedTitle);

    // For price, suppose we also have an input (here hard-coded for demo):
    const price = 45.67;
    const priceBracket = categorizePrice(price);
    console.log("\nPrice:", price, "=> Price Bracket:", priceBracket);

    // Combine categorization results from vision, description, and title.
    const combinedCategorization = await combineAllSources(visionLabels, manualDescription, normalizedTitle, attributesDictionary);
    console.log("\nCombined Hybrid Categorization (with weighted and summed scores):");
    console.log(JSON.stringify(combinedCategorization, null, 2));

    // (In your backend, you would then save these values into the corresponding fields of your Post document.)
  } catch (error) {
    console.error("Error analyzing image:", error);
  }
}

// 9. MAIN ENTRY POINT
/*tf.setBackend('cpu').then(() => {
  console.log("TensorFlow backend set to:", tf.getBackend());
  // Replace with a publicly accessible image URL.
  const imageUrl = 'https://media-photos.depop.com/b1/33111251/2463010366_8d8a5b2de3014883ada2faa5dd2d15ea/P1.jpg';
  analyzeImageAndCategorize(imageUrl, description, title);
});
*/
// At the very end of visionProcessor.js
module.exports = {
  analyzeImageAndCategorize,
  // you can export additional functions here if needed
};
