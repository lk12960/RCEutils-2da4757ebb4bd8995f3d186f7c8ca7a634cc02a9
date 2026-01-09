// events/ready.js
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    try {
      const { initCacheForGuild } = require('../utils/rolesManager');
      for (const [id] of client.guilds.cache) {
        await initCacheForGuild(id);
      }
    } catch (e) {
      console.error('Failed initializing roles cache:', e);
    }
    
    // Start monthly reset checker
    try {
      const { startMonthlyResetChecker } = require('../utils/monthlyReset');
      startMonthlyResetChecker(client);
    } catch (e) {
      console.error('Failed starting monthly reset checker:', e);
    }
    
    // Start LOA expiration checker
    try {
      const { startLOAExpirationChecker } = require('../utils/loaExpirationChecker');
      startLOAExpirationChecker(client);
    } catch (e) {
      console.error('Failed starting LOA expiration checker:', e);
    }
  },
};