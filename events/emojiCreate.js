// events/emojiCreate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'emojiCreate',

  async execute(emoji) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = emoji.guild?.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executorTag = 'Unknown';
    try {
      const fetchedLogs = await emoji.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.EmojiCreate,
      });

      const logEntry = fetchedLogs.entries.find(entry => entry.target.id === emoji.id);
      if (logEntry && logEntry.executor) {
        executorTag = `${logEntry.executor.tag} (${logEntry.executor.id})`;
      }
    } catch (err) {
      console.error('Failed to fetch audit logs for emojiCreate:', err);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('➕ Emoji Created')
      .setThumbnail(emoji.url)
      .addFields(
        { name: '➜ Emoji', value: `${emoji} \`:${emoji.name}:\` (${emoji.id})`, inline: false },
        { name: '➜ Created By', value: executorTag, inline: false },
        { name: '➜ Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: '➜ Managed', value: emoji.managed ? 'Yes' : 'No', inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Emoji Created' });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send emojiCreate log:', error);
    }
  },
};