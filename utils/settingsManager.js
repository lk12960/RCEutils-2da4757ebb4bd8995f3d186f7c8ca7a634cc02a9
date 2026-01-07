const db = require('../database/db');

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM bot_settings WHERE key = ?`, [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

module.exports = { setSetting, getSetting };
