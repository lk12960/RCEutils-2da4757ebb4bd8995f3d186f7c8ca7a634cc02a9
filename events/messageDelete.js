const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor, truncate } = require('../utils/auditLogger');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return; // Ignore DMs
    if (message.author?.bot) return; // Ignore bot messages

    try {
      // Try to find who deleted the message
      let executor = null;
      const entry = await findExecutor(message.guild, AuditLogEvent.MessageDelete, (e) => {
        return e.target?.id === message.author?.id && 
               e.extra?.channel?.id === message.channel.id &&
               Date.now() - e.createdTimestamp < 5000; // Within 5 seconds
      });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Message Deleted',
        emoji: LogEmojis.MESSAGE_DELETE,
        color: LogColors.DELETE,
      });

      embed.addFields(
        { name: '👤 Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
        { name: '📍 Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: '🆔 Message ID', value: `\`${message.id}\``, inline: true }
      );

      if (executor && executor.id !== message.author?.id) {
        embed.addFields({ name: '🗑️ Deleted By', value: formatExecutor(executor), inline: true });
      } else {
        embed.addFields({ name: '🗑️ Deleted By', value: 'Author or Unknown', inline: true });
      }

      // Message content
      if (message.content) {
        embed.addFields({ name: '📝 Content', value: truncate(message.content, 1024), inline: false });
      } else if (message.embeds.length > 0) {
        embed.addFields({ name: '📝 Content', value: `[Embed Only - ${message.embeds.length} embed(s)]`, inline: false });
      } else if (message.attachments.size > 0) {
        embed.addFields({ name: '📝 Content', value: `[${message.attachments.size} attachment(s)]`, inline: false });
      } else {
        embed.addFields({ name: '📝 Content', value: '[No text content]', inline: false });
      }

      // Attachments
      if (message.attachments.size > 0) {
        const attachmentList = message.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
        embed.addFields({ name: '📎 Attachments', value: truncate(attachmentList, 1024), inline: false });
      }

      // Embeds
      if (message.embeds.length > 0) {
        embed.addFields({ name: '📋 Embeds', value: `${message.embeds.length} embed(s)`, inline: true });
      }

      // Stickers
      if (message.stickers.size > 0) {
        const stickerList = message.stickers.map(s => s.name).join(', ');
        embed.addFields({ name: '🎨 Stickers', value: stickerList, inline: true });
      }

      embed.addFields({ name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false });

      if (message.author?.avatarURL()) {
        embed.setThumbnail(message.author.avatarURL());
      }

      embed.setFooter({ text: `Message ID: ${message.id}` });

      await sendAuditLog(message.guild, {
        category: LogCategories.MESSAGES,
        embed,
      });
    } catch (error) {
      console.error('Error in messageDelete:', error);
    }
  },
};
