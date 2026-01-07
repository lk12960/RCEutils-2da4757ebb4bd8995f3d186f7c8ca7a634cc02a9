const db = require('../database/db');

function track(type, amount = 1, guildId = null, meta = null) {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString();
    db.run(
      `INSERT INTO stats_events (guild_id, type, amount, meta, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [String(guildId || ''), String(type), Number(amount) || 1, meta ? JSON.stringify(meta) : null, ts],
      function (err) { if (err) return reject(err); resolve(true); }
    );
  });
}

function summarize(guildId, sinceIso = null, types = null) {
  return new Promise((resolve, reject) => {
    const clauses = [];
    const params = [];
    if (guildId) { clauses.push('guild_id = ?'); params.push(String(guildId)); }
    if (sinceIso) { clauses.push('timestamp >= ?'); params.push(String(sinceIso)); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT type, SUM(amount) AS total FROM stats_events ${where} GROUP BY type`;
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      const map = new Map();
      for (const r of rows || []) map.set(r.type, Number(r.total) || 0);
      if (types && Array.isArray(types)) {
        const out = {};
        for (const t of types) out[t] = map.get(t) || 0;
        return resolve(out);
      }
      const out = {}; map.forEach((v,k)=> out[k]=v);
      resolve(out);
    });
  });
}

module.exports = { track, summarize };
