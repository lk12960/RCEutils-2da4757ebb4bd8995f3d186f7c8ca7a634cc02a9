const db = require('../database/db');

// LOA Configuration
const LOA_REQUEST_CHANNEL_ID = '1458931849937293489';
const LOA_LOGS_CHANNEL_ID = '1458931874536755423';
const MANAGEMENT_ROLE_ID = '1411100904949682236';
const LOA_ROLE_ID = '1458933157834264778';

// Initialize LOA tables
db.serialize(() => {
  // Main LOA records table
  db.run(`
    CREATE TABLE IF NOT EXISTS loa_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      request_time TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      denied_by TEXT,
      denied_at TEXT,
      ended_early INTEGER DEFAULT 0,
      ended_early_at TEXT,
      is_extension INTEGER DEFAULT 0,
      original_loa_id INTEGER,
      FOREIGN KEY (original_loa_id) REFERENCES loa_records(id)
    )
  `);
  
  // LOA edit history
  db.run(`
    CREATE TABLE IF NOT EXISTS loa_edit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loa_id INTEGER NOT NULL,
      edited_by TEXT NOT NULL,
      edited_at TEXT NOT NULL,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      FOREIGN KEY (loa_id) REFERENCES loa_records(id)
    )
  `);
});

/**
 * Parse duration string (e.g., "1d", "2w", "3h") to milliseconds
 */
function parseDuration(durationStr) {
  const match = durationStr.trim().match(/^(\d+(?:\.\d+)?)\s*([smhdw])$/i);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000
  };
  
  return value * multipliers[unit];
}

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  
  if (weeks > 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Create a new LOA request
 */
function createLOARequest(userId, durationMs, reason, isExtension = false, originalLoaId = null) {
  return new Promise((resolve, reject) => {
    const requestTime = new Date().toISOString();
    const startTime = new Date().toISOString(); // Will be updated on approval
    const endTime = new Date(Date.now() + durationMs).toISOString();
    
    db.run(
      `INSERT INTO loa_records (user_id, start_time, end_time, duration_ms, reason, status, request_time, is_extension, original_loa_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [userId, startTime, endTime, durationMs, reason, requestTime, isExtension ? 1 : 0, originalLoaId],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Get active LOA for a user
 */
function getActiveLOA(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM loa_records 
       WHERE user_id = ? AND status = 'ACTIVE' AND end_time > ?
       ORDER BY start_time DESC LIMIT 1`,
      [userId, new Date().toISOString()],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

/**
 * Get all active LOAs
 */
function getAllActiveLOAs() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM loa_records 
       WHERE status = 'ACTIVE' AND end_time > ?
       ORDER BY end_time ASC`,
      [new Date().toISOString()],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Get LOA history for a user (last 3 completed LOAs)
 */
function getLOAHistory(userId, limit = 3) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM loa_records 
       WHERE user_id = ? AND status IN ('COMPLETED', 'ENDED_EARLY')
       ORDER BY end_time DESC LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Get LOA by ID
 */
function getLOAById(loaId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM loa_records WHERE id = ?`,
      [loaId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

/**
 * Approve LOA
 */
function approveLOA(loaId, approvedBy) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const startTime = now;
    
    db.get(`SELECT duration_ms FROM loa_records WHERE id = ?`, [loaId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('LOA not found'));
      
      const endTime = new Date(Date.now() + row.duration_ms).toISOString();
      
      db.run(
        `UPDATE loa_records 
         SET status = 'ACTIVE', approved_by = ?, approved_at = ?, start_time = ?, end_time = ?
         WHERE id = ?`,
        [approvedBy, now, startTime, endTime, loaId],
        function (err2) {
          if (err2) return reject(err2);
          resolve(this.changes > 0);
        }
      );
    });
  });
}

/**
 * Deny LOA
 */
function denyLOA(loaId, deniedBy) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.run(
      `UPDATE loa_records 
       SET status = 'DENIED', denied_by = ?, denied_at = ?
       WHERE id = ?`,
      [deniedBy, now, loaId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * End LOA (naturally or early)
 */
function endLOA(loaId, endedEarly = false) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const status = endedEarly ? 'ENDED_EARLY' : 'COMPLETED';
    
    const updates = endedEarly
      ? `status = ?, ended_early = 1, ended_early_at = ?`
      : `status = ?`;
    
    const params = endedEarly
      ? [status, now, loaId]
      : [status, loaId];
    
    db.run(
      `UPDATE loa_records SET ${updates} WHERE id = ?`,
      params,
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Extend LOA (admin only - directly extends without approval)
 */
function extendLOA(loaId, additionalMs, newReason = null) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT end_time, reason FROM loa_records WHERE id = ?`, [loaId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('LOA not found'));
      
      const currentEndTime = new Date(row.end_time);
      const newEndTime = new Date(currentEndTime.getTime() + additionalMs).toISOString();
      
      const updates = [];
      const params = [];
      
      updates.push('end_time = ?');
      params.push(newEndTime);
      
      if (newReason) {
        updates.push('reason = ?');
        params.push(newReason);
      }
      
      params.push(loaId);
      
      db.run(
        `UPDATE loa_records SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function (err2) {
          if (err2) return reject(err2);
          resolve(this.changes > 0);
        }
      );
    });
  });
}

/**
 * Update LOA reason (admin only)
 */
function updateLOAReason(loaId, newReason, editedBy) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT reason FROM loa_records WHERE id = ?`, [loaId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('LOA not found'));
      
      const oldReason = row.reason;
      const editedAt = new Date().toISOString();
      
      db.serialize(() => {
        db.run(
          `UPDATE loa_records SET reason = ? WHERE id = ?`,
          [newReason, loaId],
          function (err2) {
            if (err2) return reject(err2);
            
            // Log the edit
            db.run(
              `INSERT INTO loa_edit_history (loa_id, edited_by, edited_at, field_changed, old_value, new_value)
               VALUES (?, ?, ?, 'reason', ?, ?)`,
              [loaId, editedBy, editedAt, oldReason, newReason],
              (err3) => {
                if (err3) return reject(err3);
                resolve(true);
              }
            );
          }
        );
      });
    });
  });
}

/**
 * Check for expired LOAs and return them
 */
function getExpiredLOAs() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.all(
      `SELECT * FROM loa_records 
       WHERE status = 'ACTIVE' AND end_time <= ?`,
      [now],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

module.exports = {
  LOA_REQUEST_CHANNEL_ID,
  LOA_LOGS_CHANNEL_ID,
  MANAGEMENT_ROLE_ID,
  LOA_ROLE_ID,
  parseDuration,
  formatDuration,
  createLOARequest,
  getActiveLOA,
  getAllActiveLOAs,
  getLOAHistory,
  getLOAById,
  approveLOA,
  denyLOA,
  endLOA,
  extendLOA,
  updateLOAReason,
  getExpiredLOAs
};
