// Applications Database Schema
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'applications.db'), (err) => {
  if (err) {
    console.error('Failed to open applications database:', err);
  } else {
    console.log('📋 Applications database connected');
  }
});

// Create all necessary tables
db.serialize(() => {
  // Application Forms Table
  db.run(`
    CREATE TABLE IF NOT EXISTS application_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'archived', 'deleted'
      requirements TEXT, -- JSON string of requirements
      questions TEXT NOT NULL, -- JSON array of question objects
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      settings TEXT -- JSON: colors, messages, etc
    )
  `);

  // Application Submissions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS application_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      discriminator TEXT,
      avatar TEXT,
      roblox_username TEXT,
      roblox_id TEXT,
      status TEXT DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'accepted', 'denied', 'custom'
      custom_status TEXT,
      responses TEXT NOT NULL, -- JSON object of responses
      reviewed_by TEXT,
      reviewed_at TEXT,
      submitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      auto_delete_at TEXT, -- 30 days after review
      FOREIGN KEY (form_id) REFERENCES application_forms(id)
    )
  `);

  // Application Statistics Table
  db.run(`
    CREATE TABLE IF NOT EXISTS application_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER,
      stat_type TEXT NOT NULL, -- 'submission', 'acceptance', 'denial', 'view'
      user_id TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (form_id) REFERENCES application_forms(id)
    )
  `);

  // Application Access Log Table (for rate limiting and security)
  db.run(`
    CREATE TABLE IF NOT EXISTS application_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      action TEXT NOT NULL, -- 'view', 'start', 'save', 'submit'
      form_id INTEGER,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (form_id) REFERENCES application_forms(id)
    )
  `);

  // User Eligibility Cache Table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_eligibility_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      form_id INTEGER NOT NULL,
      is_eligible INTEGER DEFAULT 0,
      reason TEXT,
      cached_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (form_id) REFERENCES application_forms(id)
    )
  `);

  console.log('✅ Applications database tables initialized');
});

// Cleanup old submissions (auto-delete after 30 days)
function cleanupOldSubmissions() {
  const now = new Date().toISOString();
  db.run(
    `DELETE FROM application_submissions 
     WHERE auto_delete_at IS NOT NULL AND auto_delete_at < ?`,
    [now],
    function(err) {
      if (err) {
        console.error('Error cleaning up old submissions:', err);
      } else if (this.changes > 0) {
        console.log(`🧹 Deleted ${this.changes} old application submission(s)`);
      }
    }
  );
}

// Run cleanup every hour
setInterval(cleanupOldSubmissions, 60 * 60 * 1000);

// Run cleanup on startup
setTimeout(cleanupOldSubmissions, 5000);

module.exports = db;
