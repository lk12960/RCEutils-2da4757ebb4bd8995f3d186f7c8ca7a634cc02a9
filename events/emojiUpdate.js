// events/emojiUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'emojiUpdate',

  async execute(oldEmoji, newEmoji) {
    try {
      // Find who updated the emoji
      const entry = await findExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, { id: newEmoji.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const changes = [];

      // Check name change
      if (oldEmoji.name !== newEmoji.name) {
        changes.push(`**Name:** \`${oldEmoji.name}\` → \`${newEmoji.name}\``);
      }

      // Check animated change
      if (oldEmoji.animated !== newEmoji.animated) {
        changes.push(`**Animated:** ${oldEmoji.animated ? 'Yes' : 'No'} → ${newEmoji.animated ? 'Yes' : 'No'}`);
      }

      // Check managed change
      if (oldEmoji.managed !== newEmoji.managed) {
        changes.push(`**Managed:** ${oldEmoji.managed ? 'Yes' : 'No'} → ${newEmoji.managed ? 'Yes' : 'No'}`);
      }

      // Check role restrictions
      const oldRoles = oldEmoji.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'None';
      const newRoles = newEmoji.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'None';

      if (oldRoles !== newRoles) {
        changes.push(`**Role Restrictions:**\n• Before: ${oldRoles}\n• After: ${newRoles}`);
      }

      // If no changes detected, return
      if (changes.length === 0) return;

      const embed = createBaseEmbed({
        title: 'Emoji Updated',
        emoji: LogEmojis.EMOJI_UPDATE,
        color: LogColors.UPDATE,
      });

      embed.setThumbnail(newEmoji.url);

      embed.addFields(
        { name: '😀 Emoji', value: `${newEmoji} \`:${newEmoji.name}:\``, inline: true },
        { name: '🆔 Emoji ID', value: `\`${newEmoji.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Updated By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields({ 
        name: '📝 Changes', 
        value: changes.join('\n'), 
        inline: false 
      });

      embed.addFields({ name: '⏰ Updated', value: formatTimestamp(Date.now()), inline: false });
      embed.setFooter({ text: `Emoji ID: ${newEmoji.id}` });

      await sendAuditLog(newEmoji.guild, {
        category: LogCategories.EMOJIS,
        embed,
      });
    } catch (error) {
      console.error('Failed to log emojiUpdate:', error);
    }
  },
};
