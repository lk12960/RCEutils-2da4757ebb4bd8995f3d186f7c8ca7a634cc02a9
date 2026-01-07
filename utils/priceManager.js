const db = require('../database/db');

const CATEGORY_ORDER = ['Livery', 'Uniform', 'ELS', 'Graphics', 'Discord Server', 'Discord Bot'];

const DEFAULTS = {
  'Livery': [ ['LEO', '110'], ['FD', '140'], ['Misc.', '100'] ],
  'Uniform': [ ['Uniform', '100'] ],
  'ELS': [ ['ELS', '40'] ],
  'Graphics': [ ['Graphics (Logos, Banners, ETC)', '50-4000'] ],
  'Discord Server': [ ['Discord Server', '200-5000'] ],
  'Discord Bot': [ ['Discord Bot', '100-6000'] ],
};

function setPrice(category, item, price) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_prices (category, item, price) VALUES (?, ?, ?) ON CONFLICT(category, item) DO UPDATE SET price = excluded.price`,
      [category, item, String(price)],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getPrice(category, item) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT price FROM bot_prices WHERE category = ? AND item = ?`, [category, item], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.price : null);
    });
  });
}

function getItemsForCategory(category) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT item, price FROM bot_prices WHERE category = ? ORDER BY item ASC`, [category], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function seedDefaultsIfEmpty() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as c FROM bot_prices`, [], async (err, row) => {
      if (err) return reject(err);
      if (row && row.c > 0) return resolve(false);
      try {
        await Promise.all(
          Object.entries(DEFAULTS).flatMap(([cat, items]) =>
            items.map(([item, price]) => setPrice(cat, item, price))
          )
        );
        resolve(true);
      } catch (e) { reject(e); }
    });
  });
}

function listCategories() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT DISTINCT category FROM bot_prices`, [], (err, rows) => {
      if (err) return reject(err);
      const cats = (rows || []).map(r => r.category);
      const ordered = cats.sort((a,b)=>{
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      resolve(ordered);
    });
  });
}

function renameCategory(oldName, newName) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE bot_prices SET category = ? WHERE category = ?`, [newName, oldName], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

function removeCategory(name) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM bot_prices WHERE category = ?`, [name], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

function addItem(category, item, price) {
  return setPrice(category, item, price);
}

function removeItem(category, item) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM bot_prices WHERE category = ? AND item = ?`, [category, item], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

function renameItem(category, oldItem, newItem) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE bot_prices SET item = ? WHERE category = ? AND item = ?`, [newItem, category, oldItem], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

async function ensureCanonicalCategoryNames() {
  // Rename known legacy plural names to singular
  const renames = [
    ['Discord Servers', 'Discord Server'],
    ['Discord Bots', 'Discord Bot'],
  ];
  for (const [oldName, newName] of renames) {
    await new Promise((resolve, reject) => {
      db.get(`SELECT 1 FROM bot_prices WHERE category = ? LIMIT 1`, [oldName], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(false);
        db.run(`UPDATE bot_prices SET category = ? WHERE category = ?`, [newName, oldName], function (e) {
          if (e) return reject(e);
          resolve(true);
        });
      });
    });
  }
}

module.exports = { CATEGORY_ORDER, DEFAULTS, setPrice, getPrice, getItemsForCategory, seedDefaultsIfEmpty, listCategories, renameCategory, removeCategory, addItem, removeItem, renameItem, ensureCanonicalCategoryNames };
