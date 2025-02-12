const { spawn } = require('child_process');
const path = require('path');
const User = require('./models/User'); // Adjust the path as needed
const Post = require('./models/Post');

/**
 * Calculates preference centers for a user by spawning the Python script.
 * This function will:
 *   - Fetch the user and posts.
 *   - Extract descriptions from liked and disliked posts.
 *   - Call the python script to calculate cluster centers.
 *   - Update the user document with the resulting centers.
 */
async function calculatePreferenceCenters(userId) {
  try {
    // Fetch the user document
    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found");
      return;
    }

    // Only run if total swipes >= 30
    if ((user.likedPosts.length + user.dislikedPosts.length) < 30) {
      console.log("Not enough swipes to calculate preferences");
      return;
    }

    // Fetch the posts that the user has liked and disliked
    const likedPosts = await Post.find({ _id: { $in: user.likedPosts } });
    const dislikedPosts = await Post.find({ _id: { $in: user.dislikedPosts } });

    // Extract the descriptions – adjust the field name as needed (here we try product_description first, then description)
    const likedDescriptions = likedPosts.map(p => p.product_description || p.description || "").filter(s => s);
    const dislikedDescriptions = dislikedPosts.map(p => p.product_description || p.description || "").filter(s => s);

    // Spawn the python process
    const pythonScript = path.join(__dirname, 'calculatePreferences.py');
    const pythonProcess = spawn('python3', [pythonScript]);

    let result = "";
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error("Python error:", data.toString());
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        return;
      }
      try {
        const output = JSON.parse(result);
        // Update the user document with preference centers
        user.likedPreferenceCenters = output.liked;
        user.dislikedPreferenceCenters = output.disliked;
        await user.save();
        console.log("Updated preference centers for user", userId);
      } catch (e) {
        console.error("Error parsing python output", e);
      }
    });

    // Send JSON input to the python script via stdin
    const input = { liked: likedDescriptions, disliked: dislikedDescriptions };
    pythonProcess.stdin.write(JSON.stringify(input));
    pythonProcess.stdin.end();

  } catch (err) {
    console.error("Error in calculatePreferenceCenters:", err);
  }
}

module.exports = { calculatePreferenceCenters };
