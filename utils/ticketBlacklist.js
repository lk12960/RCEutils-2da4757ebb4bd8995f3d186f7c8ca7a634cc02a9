const db = require('../database/db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_blacklist (
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL, -- 'order' | 'support' | 'all'
      reason TEXT,
      moderator_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, scope)
    )
  `);
});

function setBlacklist(userId, scope, reason, moderatorId) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO ticket_blacklist (user_id, scope, reason, moderator_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      [String(userId), String(scope), String(reason || ''), String(moderatorId), createdAt],
      function (err) {
        if (err) return reject(err);
        // fire-and-forget stats
        try { require('./stats').track('ticket_blacklisted', 1, null, { userId, scope }).catch(()=>{}); } catch {}
        resolve(true);
      }
    );
  });
}

function removeBlacklist(userId, scope) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM ticket_blacklist WHERE user_id = ? AND scope = ?`, [String(userId), String(scope)], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

function isBlacklisted(userId, scope) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT scope FROM ticket_blacklist WHERE user_id = ?`, [String(userId)], (err, rows) => {
      if (err) return reject(err);
      const scopes = (rows || []).map(r => r.scope);
      const blocked = scopes.includes('all') || scopes.includes(scope);
      resolve(blocked);
    });
  });
}

function listBlacklisted() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT user_id, scope, reason, moderator_id, created_at FROM ticket_blacklist ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = { setBlacklist, removeBlacklist, isBlacklisted, listBlacklisted };
