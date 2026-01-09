require("dotenv").config();
const axios = require("axios");

const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;

if (!BLOXLINK_API_KEY) {
  throw new Error("❌ BLOXLINK_API_KEY is missing from environment variables");
}

/**
 * Convert Roblox username → userId
 * @param {string} username
 * @returns {Promise<number|null>}
 */
async function getRobloxUserId(username) {
  const res = await axios.post(
    "https://users.roblox.com/v1/usernames/users",
    {
      usernames: [username],
      excludeBannedUsers: false
    },
    {
      headers: {
        "Content-Type": "application/json"
      },
      validateStatus: () => true
    }
  );

  if (res.status !== 200 || !res.data?.data?.length) {
    return null;
  }

  return res.data.data[0].id;
}

/**
 * Reverse lookup Discord IDs from Roblox ID using Bloxlink
 * @param {string} guildId
 * @param {number} robloxId
 * @returns {Promise<string[]>}
 */
async function getDiscordIdsFromRoblox(guildId, robloxId) {
  const url = `https://api.blox.link/v4/public/guilds/${guildId}/roblox-to-discord/${robloxId}`;

  const res = await axios.get(url, {
    headers: {
      Authorization: BLOXLINK_API_KEY
    },
    validateStatus: () => true
  });

  if (res.status !== 200) {
    console.error("[Bloxlink] API error:", res.status, res.data);
    return [];
  }

  return Array.isArray(res.data.discordIDs)
    ? res.data.discordIDs
    : [];
}

/**
 * Full helper: Roblox username → Discord IDs in server
 * @param {string} guildId
 * @param {string} robloxUsername
 */
async function resolveDiscordFromRoblox(guildId, robloxUsername) {
  const robloxId = await getRobloxUserId(robloxUsername);
  if (!robloxId) {
    throw new Error("Roblox user not found");
  }

  const discordIds = await getDiscordIdsFromRoblox(guildId, robloxId);

  return {
    robloxId,
    discordIds
  };
}

module.exports = {
  resolveDiscordFromRoblox,
  getRobloxUserId,
  getDiscordIdsFromRoblox
};
