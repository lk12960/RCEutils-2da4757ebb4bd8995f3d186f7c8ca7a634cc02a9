// events/emojiCreate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'emojiCreate',

  async execute(emoji) {
    try {
      // Find who created the emoji
      const entry = await findExecutor(emoji.guild, AuditLogEvent.EmojiCreate, { id: emoji.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Emoji Created',
        emoji: LogEmojis.EMOJI_CREATE,
        color: LogColors.CREATE,
      });

      embed.setThumbnail(emoji.url);

      embed.addFields(
        { name: '😀 Emoji', value: `${emoji} \`:${emoji.name}:\``, inline: true },
        { name: '📝 Name', value: emoji.name, inline: true },
        { name: '🆔 Emoji ID', value: `\`${emoji.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Created By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields(
        { name: '🎬 Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: '🔗 Managed', value: emoji.managed ? 'Yes' : 'No', inline: true }
      );

      // Role restrictions
      if (emoji.roles.cache.size > 0) {
        const roles = emoji.roles.cache.map(r => `<@&${r.id}>`).join(', ');
        embed.addFields({ name: '🎭 Role Restrictions', value: roles, inline: false });
      }

      embed.addFields({ name: '⏰ Created', value: formatTimestamp(Date.now()), inline: false });
      embed.setFooter({ text: `Emoji ID: ${emoji.id}` });

      await sendAuditLog(emoji.guild, {
        category: LogCategories.EMOJIS,
        embed,
      });
    } catch (error) {
      console.error('Failed to log emojiCreate:', error);
    }
  },
};