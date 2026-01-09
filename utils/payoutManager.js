const db = require('../database/db');

/**
 * Get the timestamp of the last completed payout for a designer
 */
function getLastPayoutTimestamp(designerId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT decided_at FROM payouts WHERE designer_id = ? AND status = 'COMPLETED' ORDER BY decided_at DESC LIMIT 1`,
      [String(designerId)],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.decided_at : null);
      }
    );
  });
}

/**
 * Get eligible payments for a designer
 * Only includes orders from the current month that are not voided
 */
async function getEligiblePaymentsForDesigner(designerId) {
  return new Promise((resolve, reject) => {
    // Get the first day of the current month in UTC
    const now = new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartISO = firstDayOfMonth.toISOString();
    
    const query = `SELECT order_id, price, roblox_username, reason, confirmed_at, ticket_id FROM payments 
               WHERE payee_id = ? 
               AND status IN ('CONFIRMED','LOGGED') 
               AND (payout_id IS NULL OR payout_id = 0)
               AND (voided IS NULL OR voided = 0)
               AND confirmed_at >= ?
               ORDER BY confirmed_at ASC`;
    const params = [String(designerId), monthStartISO];
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function createPayoutRequest(guildId, requesterId, designerId, includedOrders, totalAmount, payoutAmount) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    db.run(
      `INSERT INTO payouts (guild_id, requester_id, designer_id, order_count, total_amount, payout_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [String(guildId), String(requesterId), String(designerId), includedOrders.length, Number(totalAmount)||0, Number(payoutAmount)||0, ts],
      function (err) {
        if (err) return reject(err);
        const payoutId = this.lastID;
        if (!includedOrders.length) return resolve({ payoutId });
        const placeholders = includedOrders.map(()=>'?').join(',');
        const ids = includedOrders.map(o => o.order_id);
        db.run(`UPDATE payments SET payout_id = ? WHERE order_id IN (${placeholders})`, [payoutId, ...ids], function (e2) {
          if (e2) return reject(e2);
          resolve({ payoutId });
        });
      }
    );
  });
}

function getPayoutById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM payouts WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function decidePayout(id, status, decidedBy, reason = null) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    db.run(`UPDATE payouts SET status = ?, decided_at = ?, decided_by = ?, decided_reason = ? WHERE id = ?`, [String(status), ts, String(decidedBy), reason ? String(reason) : null, id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

/**
 * Check if a designer has requested a payout this month
 */
function hasPayoutThisMonth(designerId) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartISO = firstDayOfMonth.toISOString();
    
    db.get(
      `SELECT COUNT(*) as count FROM payouts 
       WHERE designer_id = ? AND requested_at >= ?`,
      [String(designerId), monthStartISO],
      (err, row) => {
        if (err) return reject(err);
        resolve(row.count > 0);
      }
    );
  });
}

module.exports = { getEligiblePaymentsForDesigner, createPayoutRequest, getPayoutById, decidePayout, getLastPayoutTimestamp, hasPayoutThisMonth };
