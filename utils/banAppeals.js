const db = require('../database/db');

// Target guild ID for role checks
const TARGET_GUILD_ID = '1297697183503745066';

// Create ban appeals table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ban_appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      username TEXT,
      avatar TEXT,
      reason_for_ban TEXT,
      why_unban TEXT,
      status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'denied'
      is_read INTEGER DEFAULT 0, -- 0 = unread, 1 = read
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_activity TEXT NOT NULL, -- For 30-day auto-delete
      can_appeal_after TEXT, -- Null if approved, date string if denied
      denial_reason TEXT -- Reason for denial if denied
    )
  `);
  
  // Add new columns if they don't exist (for existing databases)
  db.run(`ALTER TABLE ban_appeals ADD COLUMN is_read INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE ban_appeals ADD COLUMN username TEXT`, () => {});
  db.run(`ALTER TABLE ban_appeals ADD COLUMN avatar TEXT`, () => {});
  db.run(`ALTER TABLE ban_appeals ADD COLUMN updated_at TEXT`, () => {});
  db.run(`ALTER TABLE ban_appeals ADD COLUMN last_activity TEXT`, () => {});
});

// Cleanup inactive appeals (30 days of inactivity)
function cleanupInactiveAppeals() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  db.run(
    `DELETE FROM ban_appeals WHERE last_activity < ? AND status != 'pending'`,
    [thirtyDaysAgo],
    function(err) {
      if (err) {
        console.error('Error cleaning up inactive appeals:', err);
      } else if (this.changes > 0) {
        console.log(`🧹 Deleted ${this.changes} inactive ban appeal(s)`);
      }
    }
  );
}

// Run cleanup every hour
setInterval(cleanupInactiveAppeals, 60 * 60 * 1000);

// Run cleanup on startup
setTimeout(cleanupInactiveAppeals, 5000);

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
function createBanAppeal(userId, guildId, reasonForBan, whyUnban, username = null, avatar = null) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO ban_appeals (user_id, guild_id, reason_for_ban, why_unban, status, created_at, updated_at, last_activity, username, avatar) 
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [String(userId), String(guildId), String(reasonForBan), String(whyUnban), now, now, now, username, avatar],
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
function denyBanAppeal(appealId, reviewerId, denialReason = null) {
  return new Promise((resolve, reject) => {
    const reviewedAt = new Date().toISOString();
    const cooldownEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `UPDATE ban_appeals SET status = 'denied', reviewed_by = ?, reviewed_at = ?, can_appeal_after = ?, denial_reason = ? 
       WHERE id = ?`,
      [String(reviewerId), reviewedAt, cooldownEnd, denialReason, Number(appealId)],
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
      `SELECT can_appeal_after, denial_reason FROM ban_appeals 
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
          daysRemaining: Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24)),
          denialReason: row.denial_reason || 'No reason provided'
        });
      }
    );
  });
}

/**
 * Get all ban appeals with optional filters
 */
function getAllBanAppeals(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM ban_appeals`;
    const params = [];
    const conditions = [];
    
    if (filters.status) {
      conditions.push(`status = ?`);
      params.push(filters.status);
    }
    
    if (filters.isRead !== undefined) {
      conditions.push(`is_read = ?`);
      params.push(filters.isRead ? 1 : 0);
    }
    
    if (filters.guildId) {
      conditions.push(`guild_id = ?`);
      params.push(String(filters.guildId));
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    query += ` ORDER BY created_at DESC`;
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Get appeal statistics
 */
function getAppealStats(guildId = null) {
  return new Promise((resolve, reject) => {
    const guildCondition = guildId ? `WHERE guild_id = ?` : '';
    const params = guildId ? [String(guildId)] : [];
    
    db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
        SUM(CASE WHEN is_read = 0 AND status = 'pending' THEN 1 ELSE 0 END) as unread
      FROM ban_appeals ${guildCondition}`,
      params,
      (err, row) => {
        if (err) return reject(err);
        resolve(row || { total: 0, pending: 0, approved: 0, denied: 0, unread: 0 });
      }
    );
  });
}

/**
 * Mark appeal as read
 */
function markAppealAsRead(appealId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE ban_appeals SET is_read = 1, last_activity = ? WHERE id = ?`,
      [now, Number(appealId)],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Update appeal last activity timestamp
 */
function updateAppealActivity(appealId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE ban_appeals SET last_activity = ?, updated_at = ? WHERE id = ?`,
      [now, now, Number(appealId)],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Get pending appeals for navigation (prev/next)
 */
function getPendingAppealsForNav(guildId = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT id, user_id, username, status, is_read, created_at FROM ban_appeals WHERE status = 'pending'`;
    const params = [];
    
    if (guildId) {
      query += ` AND guild_id = ?`;
      params.push(String(guildId));
    }
    
    query += ` ORDER BY created_at ASC`;
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * Delete a ban appeal
 */
function deleteBanAppeal(appealId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM ban_appeals WHERE id = ?`,
      [Number(appealId)],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
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
  getCooldownInfo,
  getAllBanAppeals,
  getAppealStats,
  markAppealAsRead,
  updateAppealActivity,
  getPendingAppealsForNav,
  deleteBanAppeal,
  TARGET_GUILD_ID
};
