// events/channelUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'channelUpdate',

  async execute(oldChannel, newChannel) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = newChannel.guild?.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executorTag = 'Unknown';
    try {
      const fetchedLogs = await newChannel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelUpdate,
      });

      const logEntry = fetchedLogs.entries.find(entry => entry.target.id === newChannel.id);
      if (logEntry && logEntry.executor) {
        executorTag = `${logEntry.executor.tag} (${logEntry.executor.id})`;
      }
    } catch (err) {
      console.error('Failed to fetch audit logs for channelUpdate:', err);
    }

    // Detect changes
    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push(`**Name**: \`${oldChannel.name}\` → \`${newChannel.name}\``);
    }

    if (oldChannel.topic !== newChannel.topic) {
      changes.push(`**Topic**: \`${oldChannel.topic || 'None'}\` → \`${newChannel.topic || 'None'}\``);
    }

    if ('nsfw' in oldChannel && oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`**NSFW**: \`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``);
    }

    if ('rateLimitPerUser' in oldChannel && oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`**Slowmode**: \`${oldChannel.rateLimitPerUser}s\` → \`${newChannel.rateLimitPerUser}s\``);
    }

    if (changes.length === 0) return; // Skip logging if nothing changed

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('✏️ Channel Updated')
      .setDescription(changes.join('\n'))
      .addFields(
        { name: '➜ Channel', value: `${newChannel.name} (${newChannel.id})`, inline: false },
        { name: '➜ Updated By', value: executorTag, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Channel Updated' });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send channelUpdate log:', error);
    }
  },
};