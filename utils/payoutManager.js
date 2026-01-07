const db = require('../database/db');

function getEligiblePaymentsForDesigner(designerId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT order_id, price, roblox_username, reason FROM payments WHERE payee_id = ? AND status IN ('CONFIRMED','LOGGED') AND (payout_id IS NULL OR payout_id = 0)`, [String(designerId)], (err, rows) => {
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

module.exports = { getEligiblePaymentsForDesigner, createPayoutRequest, getPayoutById, decidePayout };
