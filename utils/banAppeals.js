const db = require('../database/db');

// Create ban appeals table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ban_appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason_for_ban TEXT,
      why_unban TEXT,
      status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'denied'
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      can_appeal_after TEXT -- Null if approved, date string if denied
    )
  `);
});

/**
 * Check if user can appeal (not within 14 day cooldown)
 */
function canUserAppeal(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT can_appeal_after FROM ban_appeals 
       WHERE user_id = ? AND guild_id = ? AND status = 'denied' 
       ORDER BY created_at DESC LIMIT 1`,
      [String(userId), String(guildId)],
      (err, row) => {
        if (err) return reject(err);
        if (!row || !row.can_appeal_after) return resolve(true);
        
        const cooldownEnd = new Date(row.can_appeal_after);
        const now = new Date();
        resolve(now >= cooldownEnd);
      }
    );
  });
}

/**
 * Create a new ban appeal
 */
function createBanAppeal(userId, guildId, reasonForBan, whyUnban) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO ban_appeals (user_id, guild_id, reason_for_ban, why_unban, status, created_at) 
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [String(userId), String(guildId), String(reasonForBan), String(whyUnban), createdAt],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Get ban appeal by ID
 */
function getBanAppeal(appealId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ban_appeals WHERE id = ?`,
      [Number(appealId)],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

/**
 * Approve a ban appeal
 */
function approveBanAppeal(appealId, reviewerId) {
  return new Promise((resolve, reject) => {
    const reviewedAt = new Date().toISOString();
    db.run(
      `UPDATE ban_appeals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, can_appeal_after = NULL 
       WHERE id = ?`,
      [String(reviewerId), reviewedAt, Number(appealId)],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Deny a ban appeal with 14 day cooldown
 */
function denyBanAppeal(appealId, reviewerId) {
  return new Promise((resolve, reject) => {
    const reviewedAt = new Date().toISOString();
    const cooldownEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `UPDATE ban_appeals SET status = 'denied', reviewed_by = ?, reviewed_at = ?, can_appeal_after = ? 
       WHERE id = ?`,
      [String(reviewerId), reviewedAt, cooldownEnd, Number(appealId)],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Get ban case details for a user
 */
function getBanCaseDetails(userId, guildId) {
  return new Promise((resolve, reject) => {
    const caseDb = require('../database/db');
    caseDb.get(
      `SELECT * FROM cases WHERE user_id = ? AND guild_id = ? AND action = 'BAN' ORDER BY timestamp DESC LIMIT 1`,
      [String(userId), String(guildId)],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

/**
 * Get cooldown information for a user
 */
function getCooldownInfo(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT can_appeal_after FROM ban_appeals 
       WHERE user_id = ? AND guild_id = ? AND status = 'denied' 
       ORDER BY created_at DESC LIMIT 1`,
      [String(userId), String(guildId)],
      (err, row) => {
        if (err) return reject(err);
        if (!row || !row.can_appeal_after) return resolve(null);
        
        const cooldownEnd = new Date(row.can_appeal_after);
        const now = new Date();
        
        if (now >= cooldownEnd) {
          return resolve(null); // Cooldown expired
        }
        
        resolve({
          canAppealAfter: cooldownEnd,
          daysRemaining: Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24))
        });
      }
    );
  });
}

module.exports = {
  canUserAppeal,
  createBanAppeal,
  getBanAppeal,
  approveBanAppeal,
  denyBanAppeal,
  getBanCaseDetails,
  getCooldownInfo
};
