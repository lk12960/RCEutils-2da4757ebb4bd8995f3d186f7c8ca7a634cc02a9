const db = require('../database/db');

// In-memory cache: { guildId: { tier: roleId } }
const cache = new Map();

function getGuildMap(guildId) {
  if (!cache.has(guildId)) cache.set(guildId, {});
  return cache.get(guildId);
}

function initCacheForGuild(guildId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT tier, role_id FROM bot_roles WHERE guild_id = ?`, [guildId], (err, rows) => {
      if (err) return reject(err);
      const map = {};
      for (const r of rows || []) map[r.tier] = r.role_id;
      cache.set(guildId, map);
      resolve(map);
    });
  });
}

function setTierRole(guildId, tier, roleId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_roles (guild_id, tier, role_id) VALUES (?, ?, ?) ON CONFLICT(guild_id, tier) DO UPDATE SET role_id = excluded.role_id`,
      [guildId, tier, roleId],
      function (err) {
        if (err) return reject(err);
        const m = getGuildMap(guildId);
        m[tier] = roleId;
        resolve(true);
      }
    );
  });
}

function getTierRole(guildId, tier) {
  const m = cache.get(guildId);
  if (m && m[tier]) return m[tier];
  return null;
}

function getAllTiers(guildId) {
  const m = cache.get(guildId) || {};
  return { ...m };
}

module.exports = { initCacheForGuild, setTierRole, getTierRole, getAllTiers, _cache: cache };
