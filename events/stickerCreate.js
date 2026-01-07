// events/stickerCreate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'stickerCreate',

  async execute(sticker) {
    try {
      // Try to find who created the sticker
      let executor = null;
      const entry = await findExecutor(sticker.guild, AuditLogEvent.StickerCreate, { id: sticker.id });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Sticker Created',
        emoji: LogEmojis.STICKER_CREATE,
        color: LogColors.CREATE,
      });

      embed.addFields(
        { name: '🎨 Sticker Name', value: `${sticker.name} (\`${sticker.id}\`)`, inline: false },
        { name: '👤 Created By', value: executor ? formatExecutor(executor) : (sticker.user ? formatExecutor(sticker.user) : 'Unknown'), inline: true },
        { name: '🏷️ Tags', value: sticker.tags || 'None', inline: true }
      );

      if (sticker.description) {
        embed.addFields({ name: '📝 Description', value: sticker.description, inline: false });
      }

      embed.addFields({ name: '⏰ Created', value: formatTimestamp(Date.now()), inline: false });

      if (sticker.url) {
        embed.setThumbnail(sticker.url);
      }

      embed.setFooter({ text: `Sticker ID: ${sticker.id}` });

      await sendAuditLog(sticker.guild, {
        category: LogCategories.SERVER,
        embed,
      });
    } catch (error) {
      console.error('Error in stickerCreate:', error);
    }
  },
};
