// events/emojiDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'emojiDelete',

  async execute(emoji) {
    try {
      // Find who deleted the emoji
      const entry = await findExecutor(emoji.guild, AuditLogEvent.EmojiDelete, { id: emoji.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Emoji Deleted',
        emoji: LogEmojis.EMOJI_DELETE,
        color: LogColors.DELETE,
      });

      embed.addFields(
        { name: '📝 Emoji Name', value: emoji.name, inline: true },
        { name: '🆔 Emoji ID', value: `\`${emoji.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Deleted By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields(
        { name: '🎬 Was Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
        { name: '🔗 Was Managed', value: emoji.managed ? 'Yes' : 'No', inline: true }
      );

      // Role restrictions (if any existed)
      if (emoji.roles.cache.size > 0) {
        const roles = emoji.roles.cache.map(r => `<@&${r.id}>`).join(', ');
        embed.addFields({ name: '🎭 Had Role Restrictions', value: roles, inline: false });
      }

      embed.addFields({ name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false });
      embed.setFooter({ text: `Emoji ID: ${emoji.id}` });

      await sendAuditLog(emoji.guild, {
        category: LogCategories.EMOJIS,
        embed,
      });
    } catch (error) {
      console.error('Failed to log emojiDelete:', error);
    }
  },
};
