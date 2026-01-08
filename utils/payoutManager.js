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
 * Only includes orders confirmed AFTER their last completed payout
 */
async function getEligiblePaymentsForDesigner(designerId) {
  const lastPayoutTime = await getLastPayoutTimestamp(designerId);
  
  return new Promise((resolve, reject) => {
    let query, params;
    
    if (lastPayoutTime) {
      // Only get orders confirmed after the last payout
      query = `SELECT order_id, price, roblox_username, reason, confirmed_at FROM payments 
               WHERE payee_id = ? 
               AND status IN ('CONFIRMED','LOGGED') 
               AND (payout_id IS NULL OR payout_id = 0)
               AND confirmed_at > ?
               ORDER BY confirmed_at ASC`;
      params = [String(designerId), lastPayoutTime];
    } else {
      // No previous payout, get all eligible orders
      query = `SELECT order_id, price, roblox_username, reason, confirmed_at FROM payments 
               WHERE payee_id = ? 
               AND status IN ('CONFIRMED','LOGGED') 
               AND (payout_id IS NULL OR payout_id = 0)
               ORDER BY confirmed_at ASC`;
      params = [String(designerId)];
    }
    
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

module.exports = { getEligiblePaymentsForDesigner, createPayoutRequest, getPayoutById, decidePayout, getLastPayoutTimestamp };
