// events/stickerDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'stickerDelete',

  async execute(sticker) {
    try {
      // Try to find who deleted the sticker
      let executor = null;
      const entry = await findExecutor(sticker.guild, AuditLogEvent.StickerDelete, { id: sticker.id });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Sticker Deleted',
        emoji: LogEmojis.STICKER_DELETE,
        color: LogColors.DELETE,
      });

      embed.addFields(
        { name: '🎨 Sticker Name', value: `${sticker.name} (\`${sticker.id}\`)`, inline: false },
        { name: '🗑️ Deleted By', value: executor ? formatExecutor(executor) : 'Unknown', inline: true },
        { name: '🏷️ Tags', value: sticker.tags || 'None', inline: true }
      );

      if (sticker.description) {
        embed.addFields({ name: '📝 Description', value: sticker.description, inline: false });
      }

      embed.addFields({ name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false });

      embed.setFooter({ text: `Sticker ID: ${sticker.id}` });

      await sendAuditLog(sticker.guild, {
        category: LogCategories.SERVER,
        embed,
      });
    } catch (error) {
      console.error('Error in stickerDelete:', error);
    }
  },
};
