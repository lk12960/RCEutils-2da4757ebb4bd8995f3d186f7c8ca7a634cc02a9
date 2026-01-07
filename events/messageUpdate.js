const { Events, EmbedBuilder } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp, truncate } = require('../utils/auditLogger');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    // Ignore bots or DMs
    if (!oldMessage.guild || oldMessage.author?.bot) return;

    // Prevent false triggers (like embed edits)
    if (oldMessage.content === newMessage.content) return;

    try {
      const embed = createBaseEmbed({
        title: 'Message Edited',
        emoji: LogEmojis.MESSAGE_EDIT,
        color: LogColors.UPDATE,
      });

      embed.setAuthor({ 
        name: oldMessage.author.tag, 
        iconURL: oldMessage.author.displayAvatarURL() 
      });

      embed.addFields(
        { name: '👤 Author', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
        { name: '📍 Channel', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: '🆔 Message ID', value: `\`${oldMessage.id}\``, inline: true }
      );

      // Message link
      const messageLink = `[Jump to Message](https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id})`;
      embed.addFields({ name: '🔗 Link', value: messageLink, inline: false });

      // Old content
      if (oldMessage.content) {
        embed.addFields({ name: '📝 Old Content', value: truncate(oldMessage.content, 1024), inline: false });
      } else {
        embed.addFields({ name: '📝 Old Content', value: '*(empty or embed only)*', inline: false });
      }

      // New content
      if (newMessage.content) {
        embed.addFields({ name: '📝 New Content', value: truncate(newMessage.content, 1024), inline: false });
      } else {
        embed.addFields({ name: '📝 New Content', value: '*(empty or embed only)*', inline: false });
      }

      // Attachments info
      if (oldMessage.attachments.size > 0 || newMessage.attachments.size > 0) {
        embed.addFields({ 
          name: '📎 Attachments', 
          value: `Before: ${oldMessage.attachments.size} | After: ${newMessage.attachments.size}`, 
          inline: true 
        });
      }

      embed.addFields({ name: '⏰ Edited', value: formatTimestamp(Date.now()), inline: false });

      if (oldMessage.author.avatarURL()) {
        embed.setThumbnail(oldMessage.author.avatarURL());
      }

      embed.setFooter({ text: `Message ID: ${oldMessage.id}` });

      await sendAuditLog(oldMessage.guild, {
        category: LogCategories.MESSAGES,
        embed,
      });
    } catch (error) {
      console.error('Error in messageUpdate:', error);
    }
  },
};