const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('./branding');

const PAYOUT_ANNOUNCEMENT_CHANNEL_ID = '1411101232772415530';

// Track the last reset to avoid duplicate resets
let lastResetMonth = null;

/**
 * Delete all orders from previous months
 */
function deleteOldOrders() {
  return new Promise((resolve, reject) => {
    // Get the first day of the current month in UTC
    const now = new Date();
    const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartISO = firstDayOfMonth.toISOString();
    
    db.run(
      `DELETE FROM payments WHERE confirmed_at < ?`,
      [monthStartISO],
      function (err) {
        if (err) return reject(err);
        console.log(`[monthlyReset] Deleted ${this.changes} old orders from previous months`);
        resolve(this.changes);
      }
    );
  });
}

/**
 * Check if we need to perform a monthly reset
 * Should be called on bot startup and periodically
 */
async function checkAndPerformMonthlyReset(client) {
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  
  // Check if we've already reset this month
  if (lastResetMonth === currentMonth) {
    return;
  }
  
  // Check if it's past midnight on the 1st of the month (within first 24 hours)
  const dayOfMonth = now.getUTCDate();
  if (dayOfMonth !== 1) {
    return;
  }
  
  // Check if we've already reset today (within the first hour)
  const hour = now.getUTCHours();
  if (hour > 1) {
    // If it's past 1 AM UTC and we haven't reset, mark as done to avoid late resets
    lastResetMonth = currentMonth;
    return;
  }
  
  try {
    console.log(`[monthlyReset] Performing monthly reset for ${currentMonth}...`);
    
    // Delete old orders
    const deletedCount = await deleteOldOrders();
    
    // Send announcement
    const channel = client.channels.cache.get(PAYOUT_ANNOUNCEMENT_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`${BRAND_NAME} — New Monthly Payout Period`)
        .setDescription(
          `🔄 **Monthly Reset Complete**\n\n` +
          `A new payout period has begun! All orders from previous months have been archived.\n\n` +
          `**What this means:**\n` +
          `• Previous month's orders have been cleared from the system\n` +
          `• Payout requests will now only include orders from this month\n` +
          `• Designers can continue logging new orders as usual\n\n` +
          `**Important:** Make sure all payouts from last month were processed before this reset!`
        )
        .setColor(BRAND_COLOR_HEX)
        .addFields(
          { name: 'Orders Archived', value: String(deletedCount), inline: true },
          { name: 'Reset Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: BRAND_NAME })
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
      console.log(`[monthlyReset] Announcement sent to channel ${PAYOUT_ANNOUNCEMENT_CHANNEL_ID}`);
    }
    
    // Mark this month as reset
    lastResetMonth = currentMonth;
    console.log(`[monthlyReset] Monthly reset complete for ${currentMonth}`);
    
  } catch (error) {
    console.error('[monthlyReset] Error performing monthly reset:', error);
  }
}

/**
 * Start the monthly reset checker
 * Checks every hour if we need to perform a reset
 */
function startMonthlyResetChecker(client) {
  // Check immediately on startup
  checkAndPerformMonthlyReset(client);
  
  // Check every hour
  setInterval(() => {
    checkAndPerformMonthlyReset(client);
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('[monthlyReset] Monthly reset checker started');
}

module.exports = { startMonthlyResetChecker, checkAndPerformMonthlyReset };
