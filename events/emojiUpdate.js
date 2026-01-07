// events/emojiUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
  name: 'emojiUpdate',

  async execute(oldEmoji, newEmoji) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = newEmoji.guild?.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executorTag = 'Unknown';
    try {
      const fetchedLogs = await newEmoji.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.EmojiUpdate,
      });

      const logEntry = fetchedLogs.entries.find(entry => entry.target.id === newEmoji.id);
      if (logEntry && logEntry.executor) {
        executorTag = `${logEntry.executor.tag} (${logEntry.executor.id})`;
      }
    } catch (err) {
      console.error('Failed to fetch audit logs for emojiUpdate:', err);
    }

    const changes = [];

    if (oldEmoji.name !== newEmoji.name) {
      changes.push(`**Name**: \`${oldEmoji.name}\` → \`${newEmoji.name}\``);
    }

    if (oldEmoji.animated !== newEmoji.animated) {
      changes.push(`**Animated**: \`${oldEmoji.animated}\` → \`${newEmoji.animated}\``);
    }

    if (oldEmoji.managed !== newEmoji.managed) {
      changes.push(`**Managed**: \`${oldEmoji.managed}\` → \`${newEmoji.managed}\``);
    }

    const oldRoles = oldEmoji.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'None';
    const newRoles = newEmoji.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'None';

    if (oldRoles !== newRoles) {
      changes.push(`**Role Restrictions**:\nFrom: ${oldRoles}\nTo: ${newRoles}`);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('🖊️ Emoji Updated')
      .setThumbnail(newEmoji.url)
      .setDescription(changes.join('\n'))
      .addFields(
        { name: '➜ Emoji', value: `${newEmoji} \`:${newEmoji.name}:\` (${newEmoji.id})`, inline: false },
        { name: '➜ Updated By', value: executorTag, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Emoji Updated' });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send emojiUpdate log:', error);
    }
  },
};
