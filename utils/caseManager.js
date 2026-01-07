const db = require('../database/db');

// ✅ Create a new case
function createCase(userId, moderatorId, action, reason) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO cases (user_id, moderator_id, action, reason, timestamp, voided)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [userId, moderatorId, action, reason, timestamp],
      function (err) {
        if (err) {
          console.error('Failed to create case:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// ✅ Fetch case by ID
function getCaseById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM cases WHERE id = ?`, [id], (err, row) => {
      if (err) {
        console.error('Failed to fetch case:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// ✅ Fetch all cases for a user
function getCasesByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM cases WHERE user_id = ? ORDER BY timestamp DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Failed to fetch cases:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// ✅ Mark a case as voided
function voidCase(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE cases SET voided = 1 WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error('Failed to void case:', err);
          reject(err);
        } else {
          resolve(this.changes > 0); // true if updated
        }
      }
    );
  });
}

// ✅ Unvoid a case
function unvoidCase(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE cases SET voided = 0 WHERE id = ?`,
      [id],
      function (err) {
        if (err) {
          console.error('Failed to unvoid case:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// ✅ Transfer all cases from one user to another
function transferCases(fromUserId, toUserId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE cases SET user_id = ? WHERE user_id = ?`;
    db.run(query, [toUserId, fromUserId], function (err) {
      if (err) {
        console.error('Failed to transfer cases:', err);
        reject(err);
      } else {
        resolve(this.changes); // number of rows updated
      }
    });
  });
}

// ✅ Void all cases for a user (does NOT delete them)
function voidAllCasesForUser(userId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE cases SET voided = 1 WHERE user_id = ? AND voided = 0`;
    db.run(query, [userId], function (err) {
      if (err) {
        console.error('Failed to void cases:', err);
        reject(err);
      } else {
        resolve(this.changes); // number of cases voided
      }
    });
  });
}

// Update reason
function updateCaseReason(id, newReason) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE cases SET reason = ? WHERE id = ?`, [newReason, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

// Update user_id
function updateCaseUser(id, newUserId) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE cases SET user_id = ? WHERE id = ?`, [newUserId, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

// Update action
function updateCaseAction(id, newAction) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE cases SET action = ? WHERE id = ?`, [newAction, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

// Update moderator_id
function updateCaseModerator(id, newModeratorId) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE cases SET moderator_id = ? WHERE id = ?`, [newModeratorId, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

module.exports = {
  createCase,
  getCaseById,
  getCasesByUserId,
  voidCase,
  unvoidCase,
  transferCases,
  voidAllCasesForUser,
  updateCaseReason,
  updateCaseUser,
  updateCaseAction,
  updateCaseModerator,
};