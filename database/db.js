const sqlite3 = require('sqlite3').verbose();

// Create or connect to the database file
const db = new sqlite3.Database('./database/modlogs.db');

// Initialize the database tables
db.serialize(() => {
  // Moderation cases table
  db.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL,
      voided INTEGER DEFAULT 0
    )
  `);

  // Infractions table
  db.run(`
    CREATE TABLE IF NOT EXISTS infractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      type TEXT NOT NULL, -- Notice, Warning, Strike, Termination, Blacklist
      reason TEXT,
      notes TEXT,           -- <-- Added notes column here
      timestamp TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      message_id TEXT
    )
  `);

  // Migration: Add notes column if missing
  db.all(`PRAGMA table_info(infractions)`, [], (err, columns) => {
    if (err) return;
    const colNames = columns.map(c => c.name);
    if (!colNames.includes('notes')) {
      console.log('⚠️ Migrating infractions table: Adding notes column...');
      db.run(`ALTER TABLE infractions ADD COLUMN notes TEXT`, (e) => {
        if (e) console.error('Failed to add notes:', e);
        else console.log('✅ Added notes column to infractions');
      });
    }
  });

  // Add this inside your db.serialize() block
db.run(`
  CREATE TABLE IF NOT EXISTS scrambler_leaderboard (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    high_score INTEGER NOT NULL DEFAULT 0
  )
`);

  // Notes table
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      moderatorId TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Bot settings (key-value)
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Bot prices
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_prices (
      category TEXT NOT NULL,
      item TEXT NOT NULL,
      price TEXT NOT NULL,
      PRIMARY KEY (category, item)
    )
  `);

  // Permission roles per guild
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_roles (
      guild_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, tier)
    )
  `);

  // Category status per guild (open|closed|delayed)
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_category_status (
      guild_id TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (guild_id, category)
    )
  `);

  // Category → Role mapping per guild
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_category_roles (
      guild_id TEXT NOT NULL,
      category TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, category)
    )
  `);

  // Statistics events table
  db.run(`
    CREATE TABLE IF NOT EXISTS stats_events (
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1,
      meta TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  // Payouts
  db.run(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      designer_id TEXT NOT NULL,
      order_count INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      payout_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      decided_at TEXT,
      decided_by TEXT,
      decided_reason TEXT
    )
  `);

  // Embed templates and replies
  db.run(`
    CREATE TABLE IF NOT EXISTS embed_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS embed_replies (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Ticket ID counter
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_counter (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_ticket_id INTEGER NOT NULL DEFAULT 0
    )
  `);
});

module.exports = db;