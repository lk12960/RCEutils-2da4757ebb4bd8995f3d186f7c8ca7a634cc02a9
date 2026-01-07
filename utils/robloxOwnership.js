const axios = require("axios");

const ROBLOSECURITY = process.env.ROBLOSECURITY || "";

if (!ROBLOSECURITY) {
  console.warn("⚠️ ROBLOSECURITY environment variable is missing - ownership checks will fail!");
}

/**
 * Convert Roblox username → userId
 * @param {string} username
 * @returns {Promise<number|null>}
 */
async function getUserId(username) {
  try {
    const res = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      {
        usernames: [username],
        excludeBannedUsers: false
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        validateStatus: () => true
      }
    );

    if (res.status !== 200) {
      console.error(`Username lookup failed for ${username} (${res.status})`);
      return null;
    }

    const json = res.data;
    if (!json.data || json.data.length === 0) {
      console.error(`Username not found: ${username}`);
      return null;
    }

    return json.data[0].id;
  } catch (err) {
    console.error(`Error looking up username ${username}:`, err.message);
    return null;
  }
}

/**
 * Check if a user owns a specific asset (GamePass)
 * Uses Inventory v2 (AUTH REQUIRED)
 * @param {number} userId
 * @param {string|number} gamePassId
 * @returns {Promise<boolean>}
 */
async function userOwnsGamePass(userId, gamePassId) {
  let cursor = null;
  let pages = 0;

  try {
    while (pages < 10) { // Increased from 5 to 10 pages
      const url = new URL(`https://inventory.roblox.com/v2/assets/${gamePassId}/owners`);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const res = await axios.get(url.toString(), {
        headers: {
          Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}`,
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        validateStatus: () => true
      });

      if (res.status !== 200) {
        console.error(`Inventory API failed for gamepass ${gamePassId} (${res.status})`);
        return false;
      }

      const owners = Array.isArray(res.data?.data) ? res.data.data : [];
      for (const entry of owners) {
        // Check by userId (more reliable than username)
        if (entry.owner?.id === userId) {
          return true;
        }
      }

      cursor = res.data?.nextPageCursor;
      if (!cursor) break;

      pages++;
    }

    return false;
  } catch (err) {
    console.error(`Error checking gamepass ownership:`, err.message);
    return false;
  }
}

/**
 * Check game pass ownership using the Roblox Inventory API.
 * Combined check by username - converts username to userId first
 * @param {string|number} assetId
 * @param {string} username
 * @returns {Promise<boolean>}
 */
async function checkGamePassOwnership(assetId, username) {
  const userId = await getUserId(username);
  if (!userId) {
    console.error(`Could not find userId for username: ${username}`);
    return false;
  }

  console.log(`Checking if user ${username} (ID: ${userId}) owns gamepass ${assetId}...`);
  const owns = await userOwnsGamePass(userId, assetId);
  console.log(`Result: ${owns ? 'OWNS' : 'DOES NOT OWN'}`);
  
  return owns;
}

module.exports = { checkGamePassOwnership, getUserId, userOwnsGamePass };
