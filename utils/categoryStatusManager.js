const db = require('../database/db');

function setCategoryStatus(guildId, category, status) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_category_status (guild_id, category, status) VALUES (?, ?, ?) ON CONFLICT(guild_id, category) DO UPDATE SET status = excluded.status`,
      [guildId, category, status],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getCategoryStatus(guildId, category) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT status FROM bot_category_status WHERE guild_id = ? AND category = ?`, [guildId, category], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.status : null);
    });
  });
}

function getAllStatuses(guildId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT category, status FROM bot_category_status WHERE guild_id = ?`, [guildId], (err, rows) => {
      if (err) return reject(err);
      const map = {};
      for (const r of rows || []) map[r.category] = r.status;
      resolve(map);
    });
  });
}

module.exports = { setCategoryStatus, getCategoryStatus, getAllStatuses };
