const db = require('../database/db');

// ✅ Create new infraction with notes
function createInfraction(userId, moderatorId, type, reason, notes = null, messageId = null) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO infractions (user_id, moderator_id, type, reason, notes, timestamp, revoked, message_id)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [userId, moderatorId, type, reason, notes, timestamp, messageId],
      function (err) {
        if (err) {
          console.error('Failed to create infraction:', err);
          reject(err);
        } else {
          try { require('./stats').track('infraction', 1, null, { userId, type }).catch(()=>{}); } catch {}
          resolve(this.lastID);
        }
      }
    );
  });
}

// ✅ Get infraction by ID
function getInfractionById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM infractions WHERE id = ?`, [id], (err, row) => {
      if (err) {
        console.error('Failed to fetch infraction:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// ✅ Get all infractions for a user
function getInfractionsByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM infractions WHERE user_id = ? ORDER BY timestamp DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Failed to fetch infractions:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// ✅ Revoke (void) an infraction
function revokeInfraction(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE infractions SET revoked = 1 WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error('Failed to revoke infraction:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// ✅ Unrevoke an infraction
function unrevokeInfraction(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE infractions SET revoked = 0 WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error('Failed to unrevoke infraction:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// ✅ Update log message ID (optional)
function updateInfractionMessageId(id, messageId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE infractions SET message_id = ? WHERE id = ?`,
      [messageId, id],
      function (err) {
        if (err) {
          console.error('Failed to update infraction message ID:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// ✅ Transfer all infractions from one user to another
function transferInfractions(fromUserId, toUserId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE infractions SET user_id = ? WHERE user_id = ?`;
    db.run(query, [toUserId, fromUserId], function (err) {
      if (err) {
        console.error('Failed to transfer infractions:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

// ✅ Revoke all infractions for a user (non-destructive)
function revokeAllInfractionsForUser(userId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE infractions SET revoked = 1 WHERE user_id = ? AND revoked = 0`;
    db.run(query, [userId], function (err) {
      if (err) {
        console.error('Failed to revoke infractions:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

// ✅ Wipe all infractions (PERMANENT)
function wipeAllInfractions() {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM infractions`, function (err) {
      if (err) {
        console.error('Failed to wipe infractions:', err);
        reject(err);
      } else {
        resolve(this.changes || 0); // return count of deleted rows
      }
    });
  });
}

module.exports = {
  createInfraction,
  getInfractionById,
  getInfractionsByUserId,
  revokeInfraction,
  unrevokeInfraction,
  transferInfractions,
  revokeAllInfractionsForUser,
  updateInfractionMessageId,
  wipeAllInfractions,
};