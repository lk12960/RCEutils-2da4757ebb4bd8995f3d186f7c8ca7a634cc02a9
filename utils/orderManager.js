const db = require('../database/db');

// Creates a table to track orders -> product ids and metadata
// schema: order_id TEXT PK, product_id TEXT, roblox_username TEXT, price INTEGER, reason TEXT, created_at TEXT

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS developer_orders (
      order_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      roblox_username TEXT NOT NULL,
      price INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
});

function saveOrder(orderId, productId, robloxUsername, price, reason) {
  return new Promise((resolve, reject) => {
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO developer_orders (order_id, product_id, roblox_username, price, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, String(productId), robloxUsername, Number(price) || 0, reason, createdAt],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getOrder(orderId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM developer_orders WHERE order_id = ?`, [orderId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

module.exports = { saveOrder, getOrder };
