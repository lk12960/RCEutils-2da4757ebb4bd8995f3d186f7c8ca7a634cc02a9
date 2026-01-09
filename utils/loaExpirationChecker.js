const { getExpiredLOAs, endLOA, LOA_ROLE_ID, LOA_LOGS_CHANNEL_ID } = require('./loaManager');
const { EmbedBuilder } = require('discord.js');
const { BRAND_NAME } = require('./branding');

/**
 * Check for expired LOAs and end them
 */
async function checkExpiredLOAs(client) {
  try {
    const expiredLOAs = await getExpiredLOAs();
    
    if (expiredLOAs.length === 0) {
      return;
    }
    
    console.log(`[LOA] Found ${expiredLOAs.length} expired LOA(s) to process`);
    
    for (const loa of expiredLOAs) {
      try {
        // End the LOA
        await endLOA(loa.id, false);
        
        // Remove LOA role from all guilds
        for (const [guildId, guild] of client.guilds.cache) {
          try {
            const member = await guild.members.fetch(loa.user_id).catch(() => null);
            if (member && member.roles.cache.has(LOA_ROLE_ID)) {
              await member.roles.remove(LOA_ROLE_ID);
              console.log(`[LOA] Removed LOA role from ${member.user.tag} in ${guild.name}`);
            }
          } catch (e) {
            console.error(`[LOA] Failed to remove role from user ${loa.user_id} in guild ${guildId}:`, e);
          }
        }
        
        // Send log to LOA logs channel
        try {
          for (const [guildId, guild] of client.guilds.cache) {
            const logsChannel = guild.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const startTime = new Date(loa.start_time);
              const endTime = new Date(loa.end_time);
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Expired`)
                .setColor(0x00FF00)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'LOA ID', value: String(loa.id), inline: true },
                  { name: 'Duration', value: require('./loaManager').formatDuration(loa.duration_ms), inline: true },
                  { name: 'Started', value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
                  { name: 'Ended', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
              break; // Only send once
            }
          }
        } catch (e) {
          console.error('[LOA] Failed to send log:', e);
        }
        
        // Send DM to user
        try {
          const user = await client.users.fetch(loa.user_id);
          const endTime = new Date(loa.end_time);
          
          const dmEmbed = new EmbedBuilder()
            .setTitle(`${BRAND_NAME} — LOA Ended`)
            .setDescription('Your leave of absence has ended. Welcome back!')
            .setColor(0x00FF00)
            .addFields(
              { name: 'LOA ID', value: String(loa.id), inline: true },
              { name: 'Duration', value: require('./loaManager').formatDuration(loa.duration_ms), inline: true },
              { name: 'Ended', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: BRAND_NAME })
            .setTimestamp();
          
          await user.send({ embeds: [dmEmbed] }).catch(() => {
            console.log(`[LOA] Could not send DM to user ${loa.user_id}`);
          });
        } catch (e) {
          console.error(`[LOA] Failed to send DM to user ${loa.user_id}:`, e);
        }
        
        console.log(`[LOA] Successfully ended LOA ${loa.id} for user ${loa.user_id}`);
      } catch (error) {
        console.error(`[LOA] Failed to process expired LOA ${loa.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[LOA] Error checking expired LOAs:', error);
  }
}

/**
 * Start the LOA expiration checker
 * Checks every 5 minutes for expired LOAs
 */
function startLOAExpirationChecker(client) {
  // Check immediately on startup
  checkExpiredLOAs(client);
  
  // Check every 5 minutes
  setInterval(() => {
    checkExpiredLOAs(client);
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('[LOA] Expiration checker started');
}

module.exports = { startLOAExpirationChecker, checkExpiredLOAs };
