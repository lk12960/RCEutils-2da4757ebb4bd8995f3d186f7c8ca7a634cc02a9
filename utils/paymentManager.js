const db = require('../database/db');

// Schema init: payments table
// order_id TEXT PK, pass_id TEXT NOT NULL, roblox_username TEXT NOT NULL, price INTEGER NOT NULL,
// reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL,
// confirmed_at TEXT NULL, logged_at TEXT NULL

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      order_id TEXT PRIMARY KEY,
      pass_id TEXT NOT NULL,
      roblox_username TEXT NOT NULL,
      price INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      logged_at TEXT,
      order_num INTEGER,
      payee_id TEXT,
      payout_id INTEGER,
      ticket_id TEXT,
      voided INTEGER DEFAULT 0
    )
  `);

  // Migration: Add missing columns if they don't exist
  db.all(`PRAGMA table_info(payments)`, [], (err, columns) => {
    if (err) {
      console.error('Failed to check payments table schema:', err);
      return;
    }
    const colNames = columns.map(c => c.name);
    
    // Add order_num if missing
    if (!colNames.includes('order_num')) {
      console.log('⚠️ Migrating payments table: Adding order_num column...');
      db.run(`ALTER TABLE payments ADD COLUMN order_num INTEGER`, (e) => {
        if (e) console.error('Failed to add order_num:', e);
        else console.log('✅ Added order_num column');
      });
    }
    
    // Add payee_id if missing
    if (!colNames.includes('payee_id')) {
      console.log('⚠️ Migrating payments table: Adding payee_id column...');
      db.run(`ALTER TABLE payments ADD COLUMN payee_id TEXT`, (e) => {
        if (e) console.error('Failed to add payee_id:', e);
        else console.log('✅ Added payee_id column');
      });
    }
    
    // Add payout_id if missing
    if (!colNames.includes('payout_id')) {
      console.log('⚠️ Migrating payments table: Adding payout_id column...');
      db.run(`ALTER TABLE payments ADD COLUMN payout_id INTEGER`, (e) => {
        if (e) console.error('Failed to add payout_id:', e);
        else console.log('✅ Added payout_id column');
      });
    }
    
    // Add ticket_id if missing
    if (!colNames.includes('ticket_id')) {
      console.log('⚠️ Migrating payments table: Adding ticket_id column...');
      db.run(`ALTER TABLE payments ADD COLUMN ticket_id TEXT`, (e) => {
        if (e) console.error('Failed to add ticket_id:', e);
        else console.log('✅ Added ticket_id column');
      });
    }
    
    // Add voided if missing
    if (!colNames.includes('voided')) {
      console.log('⚠️ Migrating payments table: Adding voided column...');
      db.run(`ALTER TABLE payments ADD COLUMN voided INTEGER DEFAULT 0`, (e) => {
        if (e) console.error('Failed to add voided:', e);
        else console.log('✅ Added voided column');
      });
    }
  });

  // Generic counters table for sequences
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_counters (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);
});

async function nextOrderNumber() {
  return new Promise((resolve, reject) => {
    // Upsert counter row and increment atomically-ish
    db.get(`SELECT value FROM bot_counters WHERE key = 'order_seq'`, [], (err, row) => {
      if (err) return reject(err);
      const current = row ? Number(row.value) || 0 : 0;
      const next = current + 1;
      db.run(
        `INSERT INTO bot_counters (key, value) VALUES ('order_seq', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [next],
        function (e) { if (e) return reject(e); resolve(next); }
      );
    });
  });
}

function createPayment(orderId, passId, robloxUsername, price, reason, payeeId = null) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    (async () => {
      try {
        const orderNum = await nextOrderNumber();
        db.run(
          `INSERT INTO payments (order_id, pass_id, roblox_username, price, reason, status, created_at, order_num, payee_id)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
          [orderId, String(passId), robloxUsername, Number(price) || 0, reason, createdAt, orderNum, payeeId ? String(payeeId) : null],
          function (err) {
            if (err) return reject(err);
            try { require('./stats').track('order', 1, null, { orderId }).catch(()=>{}); } catch {}
            resolve({ ok: true, orderNum });
          }
        );
      } catch (e) { reject(e); }
    })();
  });
}

function getPayment(orderIdOrNumber) {
  return new Promise((resolve, reject) => {
    // Try by text order_id first
    db.get(`SELECT * FROM payments WHERE order_id = ?`, [orderIdOrNumber], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);
      // Fallback: try by numeric order_num
      const num = parseInt(orderIdOrNumber, 10);
      if (!isNaN(num)) {
        db.get(`SELECT * FROM payments WHERE order_num = ?`, [num], (e2, row2) => {
          if (e2) return reject(e2);
          resolve(row2 || null);
        });
      } else {
        resolve(null);
      }
    });
  });
}

function markConfirmed(orderIdOrNumber) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    
    // Try by order_id first
    db.run(
      `UPDATE payments SET status = 'CONFIRMED', confirmed_at = ? WHERE order_id = ?`,
      [ts, orderIdOrNumber],
      function (err) {
        if (err) return reject(err);
        if (this.changes > 0) {
          console.log(`[markConfirmed] Updated order_id ${orderIdOrNumber}`);
          return resolve(true);
        }
        
        // Fallback: try by order_num
        const num = parseInt(orderIdOrNumber, 10);
        if (!isNaN(num)) {
          db.run(
            `UPDATE payments SET status = 'CONFIRMED', confirmed_at = ? WHERE order_num = ?`,
            [ts, num],
            function (e2) {
              if (e2) return reject(e2);
              console.log(`[markConfirmed] Updated order_num ${num}, changes: ${this.changes}`);
              resolve(this.changes > 0);
            }
          );
        } else {
          console.log(`[markConfirmed] No rows updated for ${orderIdOrNumber}`);
          resolve(false);
        }
      }
    );
  });
}

function tryMarkLogged(orderIdOrNumber, ticketId = null) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    
    // Try by order_id first - update even if already logged (idempotent)
    db.run(
      `UPDATE payments SET status = 'LOGGED', logged_at = ?, ticket_id = ? WHERE order_id = ?`,
      [ts, ticketId, orderIdOrNumber],
      function (err) {
        if (err) return reject(err);
        if (this.changes > 0) {
          console.log(`[tryMarkLogged] Updated order_id ${orderIdOrNumber} with ticket_id ${ticketId}`);
          return resolve(true);
        }
        
        // Fallback: try by order_num
        const num = parseInt(orderIdOrNumber, 10);
        if (!isNaN(num)) {
          db.run(
            `UPDATE payments SET status = 'LOGGED', logged_at = ?, ticket_id = ? WHERE order_num = ?`,
            [ts, ticketId, num],
            function (e2) {
              if (e2) return reject(e2);
              console.log(`[tryMarkLogged] Updated order_num ${num} with ticket_id ${ticketId}, changes: ${this.changes}`);
              resolve(this.changes > 0);
            }
          );
        } else {
          console.log(`[tryMarkLogged] No rows updated for ${orderIdOrNumber}`);
          resolve(false);
        }
      }
    );
  });
}

// Get all orders for a designer with optional date filter
function getOrdersByDesigner(designerId, sinceDate = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM payments WHERE payee_id = ? AND status IN ('CONFIRMED', 'LOGGED') AND (voided IS NULL OR voided = 0)`;
    const params = [String(designerId)];
    
    if (sinceDate) {
      query += ` AND confirmed_at >= ?`;
      params.push(sinceDate);
    }
    
    query += ` ORDER BY confirmed_at DESC`;
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// Update order fields (designer, reason, voided status)
function updateOrder(orderId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const params = [];
    
    if (updates.payee_id !== undefined) {
      fields.push('payee_id = ?');
      params.push(String(updates.payee_id));
    }
    
    if (updates.reason !== undefined) {
      fields.push('reason = ?');
      params.push(String(updates.reason));
    }
    
    if (updates.voided !== undefined) {
      fields.push('voided = ?');
      params.push(updates.voided ? 1 : 0);
    }
    
    if (fields.length === 0) {
      return resolve(false);
    }
    
    params.push(orderId);
    const query = `UPDATE payments SET ${fields.join(', ')} WHERE order_id = ?`;
    
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

module.exports = { createPayment, getPayment, markConfirmed, tryMarkLogged, getOrdersByDesigner, updateOrder };
