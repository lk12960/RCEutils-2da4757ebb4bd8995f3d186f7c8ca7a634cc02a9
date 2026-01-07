// events/emojiDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'emojiDelete',

  async execute(emoji) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = emoji.guild?.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executorTag = 'Unknown';
    try {
      const fetchedLogs = await emoji.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.EmojiDelete,
      });

      const logEntry = fetchedLogs.entries.find(entry => entry.target.id === emoji.id);
      if (logEntry && logEntry.executor) {
        executorTag = `${logEntry.executor.tag} (${logEntry.executor.id})`;
      }
    } catch (err) {
      console.error('Failed to fetch audit logs for emojiDelete:', err);
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('➖ Emoji Deleted')
      .addFields(
        { name: '➜ Emoji', value: `${emoji.name} (${emoji.id})`, inline: false },
        { name: '➜ Deleted By', value: executorTag, inline: false },
        { name: '➜ Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: '➜ Managed', value: emoji.managed ? 'Yes' : 'No', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Emoji Deleted' });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send emojiDelete log:', error);
    }
  },
};
