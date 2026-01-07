const db = require('../database/db');
const { listCategories } = require('./priceManager');

// Deprecated: no longer auto-creates roles for categories
async function ensureCategoryRoles(guild) {
  return { created: 0 };
}

async function setCategoryRole(guildId, category, roleId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bot_category_roles (guild_id, category, role_id) VALUES (?, ?, ?) ON CONFLICT(guild_id, category) DO UPDATE SET role_id = excluded.role_id`,
      [guildId, category, roleId],
      function (err) { if (err) return reject(err); resolve(true); }
    );
  });
}

async function getCategoryRole(guildId, category) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT role_id FROM bot_category_roles WHERE guild_id = ? AND category = ?`, [guildId, category], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.role_id : null);
    });
  });
}

async function listCategoryRoles(guildId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT category, role_id FROM bot_category_roles WHERE guild_id = ?`, [guildId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function renameCategoryRole(guild, oldName, newName) {
  // If you rename a category, also move mapping
  await new Promise((resolve) => db.run(`UPDATE bot_category_roles SET category = ? WHERE guild_id = ? AND category = ?`, [newName, guild.id, oldName], () => resolve()));
  return true;
}

async function ensureSupportRoles(guild) {
  const names = ['General Support', 'HR Support'];
  let created = 0;
  for (const name of names) {
    let role = guild.roles.cache.find(r => r.name === name);
    if (!role) {
      try { role = await guild.roles.create({ name, mentionable: true, reason: 'Ensure support role exists' }); created++; } catch {}
    } else if (!role.mentionable) {
      try { await role.setMentionable(true, 'Allow auto-mention for support tickets'); } catch {}
    }
  }
  return { created };
}

module.exports = { ensureCategoryRoles, renameCategoryRole, ensureSupportRoles };
