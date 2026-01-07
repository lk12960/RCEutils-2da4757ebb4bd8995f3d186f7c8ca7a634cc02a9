// events/channelDelete.js
const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');

module.exports = {
  name: 'channelDelete',

  async execute(channel) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = channel.guild?.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executorTag = 'Unknown';
    try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      });

      const logEntry = fetchedLogs.entries.find(entry => entry.target.id === channel.id);
      if (logEntry && logEntry.executor) {
        executorTag = `${logEntry.executor.tag} (${logEntry.executor.id})`;
      }
    } catch (error) {
      console.error('Failed to fetch audit logs for channelDelete:', error);
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('📤 Channel Deleted')
      .addFields(
        { name: '➜ Name', value: channel.name || 'Unknown', inline: true },
        { name: '➜ Type', value: `${channel.type === ChannelType.GuildText ? 'Text' : channel.type === ChannelType.GuildVoice ? 'Voice' : 'Other'}`, inline: true },
        { name: '➜ ID', value: channel.id, inline: true },
        { name: '➜ Deleted By', value: executorTag, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Channel Deleted' });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send channelDelete log:', error);
    }
  },
};
