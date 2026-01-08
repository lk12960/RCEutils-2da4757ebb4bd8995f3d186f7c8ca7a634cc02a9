const axios = require("axios");

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
      console.error(`[Roblox] Username lookup failed (${res.status})`);
      return null;
    }

    if (!res.data?.data?.length) {
      console.error(`[Roblox] Username not found: ${username}`);
      return null;
    }

    return res.data.data[0].id;
  } catch (err) {
    console.error(`[Roblox] Username lookup error:`, err.message);
    return null;
  }
}

/**
 * Check if a user owns a specific Game Pass
 * Uses Roblox Inventory "is-owned" endpoint
 * @param {number} userId
 * @param {string|number} gamePassId
 * @returns {Promise<boolean>}
 */
async function userOwnsGamePass(userId, gamePassId) {
  try {
    const url = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamePassId}/is-owned`;

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: "application/json"
      },
      validateStatus: () => true
    });

    if (res.status !== 200) {
      console.error(
        `[Roblox] is-owned check failed (${res.status}):`,
        res.data
      );
      return false;
    }

    // Response is literally: true or false
    return res.data === true;
  } catch (err) {
    console.error(`[Roblox] is-owned request error:`, err.message);
    return false;
  }
}

/**
 * Check game pass ownership by username
 * @param {string|number} gamePassId
 * @param {string} username
 * @returns {Promise<boolean>}
 */
async function checkGamePassOwnership(gamePassId, username) {
  const userId = await getUserId(username);
  if (!userId) return false;

  console.log(
    `[Roblox] Checking ownership: ${username} (ID ${userId}) → GamePass ${gamePassId}`
  );

  const owns = await userOwnsGamePass(userId, gamePassId);

  console.log(
    `[Roblox] Ownership result: ${owns ? "OWNS" : "DOES NOT OWN"}`
  );

  return owns;
}

module.exports = {
  getUserId,
  userOwnsGamePass,
  checkGamePassOwnership
};
