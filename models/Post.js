// models/Post.js
/*
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String, required: true },
  description: {type: String, default: ""},
  uploader: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Post', PostSchema);
 */
// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  linkUrl: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  uploader: { type: String, required: true },
  price: { type: Number, required: true },
  priceRange: { type: String },
  createdAt: { type: Date, default: Date.now },
  // An "attributes" object that holds a numeric score (as a double/decimal) for every adjective
  attributes: {
    // Color:
    Red: { type: Number, default: 0 },
    Orange: { type: Number, default: 0 },
    Yellow: { type: Number, default: 0 },
    Gold: { type: Number, default: 0 },
    Olive: { type: Number, default: 0 },
    Green: { type: Number, default: 0 },
    Teal: { type: Number, default: 0 },
    Cyan: { type: Number, default: 0 },
    "Sky Blue": { type: Number, default: 0 },
    Blue: { type: Number, default: 0 },
    Navy: { type: Number, default: 0 },
    Indigo: { type: Number, default: 0 },
    Purple: { type: Number, default: 0 },
    Lavender: { type: Number, default: 0 },
    Magenta: { type: Number, default: 0 },
    Pink: { type: Number, default: 0 },
    Brown: { type: Number, default: 0 },
    Gray: { type: Number, default: 0 },

    // Material:
    Cotton: { type: Number, default: 0 },
    Linen: { type: Number, default: 0 },
    Wool: { type: Number, default: 0 },
    Cashmere: { type: Number, default: 0 },
    Silk: { type: Number, default: 0 },
    Satin: { type: Number, default: 0 },
    Rayon: { type: Number, default: 0 },
    Polyester: { type: Number, default: 0 },
    Acrylic: { type: Number, default: 0 },
    Nylon: { type: Number, default: 0 },
    Spandex: { type: Number, default: 0 },
    Denim: { type: Number, default: 0 },
    Corduroy: { type: Number, default: 0 },
    Tweed: { type: Number, default: 0 },
    Leather: { type: Number, default: 0 },
    Suede: { type: Number, default: 0 },
    Fleece: { type: Number, default: 0 },
    Velvet: { type: Number, default: 0 },
    Jersey: { type: Number, default: 0 },

    // Clothing Item Type:
    "T-shirt": { type: Number, default: 0 },
    Polo: { type: Number, default: 0 },
    boots: { type: Number, default: 0 },
    shoes: { type: Number, default: 0 },
    "Button-down Shirt": { type: Number, default: 0 },
    Blouse: { type: Number, default: 0 },
    "Tank Top": { type: Number, default: 0 },
    Sweater: { type: Number, default: 0 },
    Hoodie: { type: Number, default: 0 },
    Jacket: { type: Number, default: 0 },
    Blazer: { type: Number, default: 0 },
    Coat: { type: Number, default: 0 },
    Jeans: { type: Number, default: 0 },
    Trousers: { type: Number, default: 0 },
    Shorts: { type: Number, default: 0 },
    Skirt: { type: Number, default: 0 },
    Dress: { type: Number, default: 0 },
    Jumpsuit: { type: Number, default: 0 },
    Leggings: { type: Number, default: 0 },
    accessories: { type: Number, default: 0 },
    Swimsuit: { type: Number, default: 0 },

    // Era:
    "1920s": { type: Number, default: 0 },
    "1930s": { type: Number, default: 0 },
    "1940s": { type: Number, default: 0 },
    "1950s": { type: Number, default: 0 },
    "1960s": { type: Number, default: 0 },
    "1970s": { type: Number, default: 0 },
    "1980s": { type: Number, default: 0 },
    "1990s": { type: Number, default: 0 },
    "2000s": { type: Number, default: 0 },
    "2010s": { type: Number, default: 0 },
    "2020s": { type: Number, default: 0 },
    Futuristic: { type: Number, default: 0 },
    Cyberpunk: { type: Number, default: 0 },

    // Gender:
    "Men's": { type: Number, default: 0 },
    "Women's": { type: Number, default: 0 },
    Unisex: { type: Number, default: 0 },

    // Season:
    Winter: { type: Number, default: 0 },
    Spring: { type: Number, default: 0 },
    Summer: { type: Number, default: 0 },
    Fall: { type: Number, default: 0 },

    // Pattern:
    Solid: { type: Number, default: 0 },
    Striped: { type: Number, default: 0 },
    Plaid: { type: Number, default: 0 },
    Checkered: { type: Number, default: 0 },
    "Polka Dot": { type: Number, default: 0 },
    Floral: { type: Number, default: 0 },
    Paisley: { type: Number, default: 0 },
    Houndstooth: { type: Number, default: 0 },
    Herringbone: { type: Number, default: 0 },
    Geometric: { type: Number, default: 0 },
    Camouflage: { type: Number, default: 0 },
    "Animal Print": { type: Number, default: 0 },
    "Tie-Dye": { type: Number, default: 0 },
    Gradient: { type: Number, default: 0 },
    Abstract: { type: Number, default: 0 },

    // Country/World Region:
    USA: { type: Number, default: 0 },
    UK: { type: Number, default: 0 },
    France: { type: Number, default: 0 },
    Italy: { type: Number, default: 0 },
    Spain: { type: Number, default: 0 },
    Germany: { type: Number, default: 0 },
    Scandinavia: { type: Number, default: 0 },
    Japan: { type: Number, default: 0 },
    China: { type: Number, default: 0 },
    India: { type: Number, default: 0 },
    "Middle East": { type: Number, default: 0 },
    Africa: { type: Number, default: 0 },
    "South America": { type: Number, default: 0 },
    Australia: { type: Number, default: 0 },
    "Eastern Europe": { type: Number, default: 0 },
    Russia: { type: Number, default: 0 },

    // Embellishments:
    Embroidery: { type: Number, default: 0 },
    Sequins: { type: Number, default: 0 },
    Lace: { type: Number, default: 0 },
    Beads: { type: Number, default: 0 },
    Studs: { type: Number, default: 0 },
    Rhinestones: { type: Number, default: 0 },
    Fringe: { type: Number, default: 0 },
    Tassels: { type: Number, default: 0 },
    Pearls: { type: Number, default: 0 },
    Feathers: { type: Number, default: 0 },
    Bows: { type: Number, default: 0 },
    Buttons: { type: Number, default: 0 },
    Patches: { type: Number, default: 0 },
    "Metal Chains": { type: Number, default: 0 },
    Zippers: { type: Number, default: 0 },
    Cutouts: { type: Number, default: 0 },
    "Fur Trim": { type: Number, default: 0 },

    // Style:
    luxury: { type: Number, default: 0 },
    formal: { type: Number, default: 0 },
    minimalist: { type: Number, default: 0 },
    plain: { type: Number, default: 0 },
    preppy: { type: Number, default: 0 },
    "Business Casual": { type: Number, default: 0 },
    casual: { type: Number, default: 0 },
    Streetwear: { type: Number, default: 0 },
    grunge: { type: Number, default: 0 },
    punk: { type: Number, default: 0 },
    goth: { type: Number, default: 0 },
    vintage: { type: Number, default: 0 },
    Y2K: { type: Number, default: 0 },
    Athleisure: { type: Number, default: 0 },
    sport: { type: Number, default: 0 },
    western: { type: Number, default: 0 }
  }
});

module.exports = mongoose.model('Post', PostSchema);

