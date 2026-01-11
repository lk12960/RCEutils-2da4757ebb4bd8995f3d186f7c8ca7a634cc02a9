// events/messageReactionAdd.js
const { EmbedBuilder } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp, truncate } = require('../utils/auditLogger');

module.exports = {
  name: 'messageReactionAdd',

  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    // Fetch partial messages if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Failed to fetch reaction:', error);
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (error) {
        console.error('Failed to fetch message:', error);
        return;
      }
    }

    const message = reaction.message;
    const guild = message.guild;
    
    if (!guild) return;

    try {
      const embed = createBaseEmbed({
        title: 'Reaction Added',
        emoji: '➕',
        color: LogColors.INFO,
      });

      // Get emoji display
      const emojiDisplay = reaction.emoji.id 
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` 
        : reaction.emoji.name;

      embed.addFields(
        { name: '👤 User', value: `${user.tag} (<@${user.id}>)`, inline: true },
        { name: '😀 Reaction', value: emojiDisplay, inline: true },
        { name: '📍 Channel', value: `<#${message.channel.id}>`, inline: true }
      );

      // Add message info
      const messageContent = message.content 
        ? truncate(message.content, 200) 
        : '*[No text content]*';
      
      embed.addFields(
        { name: '💬 Message', value: messageContent, inline: false },
        { name: '🔗 Message Link', value: `[Jump to Message](${message.url})`, inline: true },
        { name: '✍️ Message Author', value: `<@${message.author.id}>`, inline: true }
      );

      embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

      if (user.avatarURL()) {
        embed.setThumbnail(user.avatarURL());
      }

      embed.setFooter({ text: `User ID: ${user.id} | Message ID: ${message.id}` });

      await sendAuditLog(guild, {
        category: LogCategories.MESSAGES,
        embed,
      });
    } catch (error) {
      console.error('Failed to log messageReactionAdd:', error);
    }
  },
};
