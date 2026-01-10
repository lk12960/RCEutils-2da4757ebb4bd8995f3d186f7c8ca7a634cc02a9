const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('View moderation statistics for a staff member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('moderator')
        .setDescription('The staff member to view stats for')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('since')
        .setDescription('Filter stats since a specific date (YYYY-MM-DD)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Permission check
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('moderator') || interaction.user;
    const sinceDate = interaction.options.getString('since');

    // Validate date format if provided
    let sinceTimestamp = null;
    if (sinceDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(sinceDate)) {
        return interaction.editReply({ content: '❌ Invalid date format. Use YYYY-MM-DD (e.g., 2024-01-01)' });
      }
      sinceTimestamp = new Date(sinceDate).getTime();
      if (isNaN(sinceTimestamp)) {
        return interaction.editReply({ content: '❌ Invalid date.' });
      }
    }

    try {
      // Get moderation statistics from modlogs
      const modStats = await getModStats(targetUser.id, sinceTimestamp);
      
      // Get LOA statistics
      const loaStats = await getLOAStats(targetUser.id, sinceTimestamp);

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 Moderation Statistics`)
        .setDescription(`Statistics for ${targetUser}${sinceDate ? `\n**Since:** ${sinceDate}` : '\n**All Time**'}`)
        .setColor(BRAND_COLOR_HEX)
        .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      // Moderation Actions
      const modFields = [];
      modFields.push(`**Bans:** ${modStats.bans}`);
      modFields.push(`**Kicks:** ${modStats.kicks}`);
      modFields.push(`**Warns:** ${modStats.warns}`);
      modFields.push(`**Mutes:** ${modStats.mutes}`);
      modFields.push(`**Softbans:** ${modStats.softbans}`);
      modFields.push(`**Unbans:** ${modStats.unbans}`);
      modFields.push(`**Unmutes:** ${modStats.unmutes}`);

      embed.addFields({
        name: '🛡️ Moderation Actions',
        value: modFields.join('\n'),
        inline: true
      });

      // Summary Stats
      const summaryFields = [];
      summaryFields.push(`**Total Actions:** ${modStats.totalActions}`);
      summaryFields.push(`**Unique Users:** ${modStats.uniqueUsers}`);
      summaryFields.push(`**Avg per Day:** ${modStats.averagePerDay}`);

      embed.addFields({
        name: '📈 Summary',
        value: summaryFields.join('\n'),
        inline: true
      });

      // LOA Stats
      const loaFields = [];
      loaFields.push(`**Accepted:** ${loaStats.accepted}`);
      loaFields.push(`**Denied:** ${loaStats.denied}`);
      loaFields.push(`**Currently Pending:** ${loaStats.hasPending ? 'Yes' : 'No'}`);
      loaFields.push(`**Total Days Off:** ${loaStats.totalDays}`);

      embed.addFields({
        name: '🏖️ Leave of Absence',
        value: loaFields.join('\n'),
        inline: false
      });

      embed.setFooter({ text: `${BRAND_NAME} • User ID: ${targetUser.id}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in modstats:', error);
      return interaction.editReply({ content: '❌ Failed to retrieve moderation statistics.' });
    }
  }
};

/**
 * Get moderation statistics from modlogs
 */
function getModStats(moderatorId, sinceTimestamp) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        action_type,
        target_id,
        timestamp
      FROM modlogs 
      WHERE moderator_id = ?
    `;
    const params = [String(moderatorId)];

    if (sinceTimestamp) {
      query += ` AND timestamp >= ?`;
      params.push(sinceTimestamp);
    }

    query += ` ORDER BY timestamp DESC`;

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);

      const stats = {
        bans: 0,
        kicks: 0,
        warns: 0,
        mutes: 0,
        softbans: 0,
        unbans: 0,
        unmutes: 0,
        totalActions: rows.length,
        uniqueUsers: new Set(),
        averagePerDay: '0'
      };

      rows.forEach(row => {
        const action = row.action_type.toLowerCase();
        
        if (action.includes('ban') && !action.includes('unban')) stats.bans++;
        else if (action.includes('kick')) stats.kicks++;
        else if (action.includes('warn')) stats.warns++;
        else if (action.includes('mute') && !action.includes('unmute')) stats.mutes++;
        else if (action.includes('softban')) stats.softbans++;
        else if (action.includes('unban')) stats.unbans++;
        else if (action.includes('unmute')) stats.unmutes++;

        stats.uniqueUsers.add(row.target_id);
      });

      stats.uniqueUsers = stats.uniqueUsers.size;

      // Calculate average per day
      if (rows.length > 0) {
        const oldestTimestamp = sinceTimestamp || rows[rows.length - 1].timestamp;
        const daysSince = Math.max(1, Math.floor((Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24)));
        stats.averagePerDay = (rows.length / daysSince).toFixed(1);
      }

      resolve(stats);
    });
  });
}

/**
 * Get LOA statistics
 */
function getLOAStats(userId, sinceTimestamp) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        status,
        start_date,
        end_date,
        created_at
      FROM loa_requests 
      WHERE user_id = ?
    `;
    const params = [String(userId)];

    if (sinceTimestamp) {
      query += ` AND created_at >= ?`;
      params.push(sinceTimestamp);
    }

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);

      const stats = {
        accepted: 0,
        denied: 0,
        hasPending: false,
        totalDays: 0
      };

      rows.forEach(row => {
        if (row.status === 'approved') {
          stats.accepted++;
          // Calculate duration in days
          if (row.start_date && row.end_date) {
            const start = new Date(row.start_date).getTime();
            const end = new Date(row.end_date).getTime();
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            stats.totalDays += days;
          }
        } else if (row.status === 'denied') {
          stats.denied++;
        } else if (row.status === 'pending') {
          stats.hasPending = true;
        }
      });

      resolve(stats);
    });
  });
}
