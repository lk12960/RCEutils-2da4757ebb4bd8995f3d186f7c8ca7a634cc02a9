// events/threadDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'threadDelete',

  async execute(thread) {
    try {
      // Try to find who deleted the thread
      let executor = null;
      const entry = await findExecutor(thread.guild, AuditLogEvent.ThreadDelete, { id: thread.id });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Thread Deleted',
        emoji: LogEmojis.THREAD_DELETE,
        color: LogColors.DELETE,
      });

      embed.addFields(
        { name: '🧵 Thread Name', value: `${thread.name} (\`${thread.id}\`)`, inline: false },
        { name: '🗑️ Deleted By', value: executor ? formatExecutor(executor) : 'Unknown', inline: true },
        { name: '📍 Parent Channel', value: thread.parent ? `<#${thread.parent.id}>` : 'Unknown', inline: true }
      );

      if (thread.ownerId) {
        embed.addFields({ name: '👤 Original Owner', value: `<@${thread.ownerId}> (\`${thread.ownerId}\`)`, inline: true });
      }

      embed.addFields(
        { name: '💬 Message Count', value: `${thread.messageCount || 0}`, inline: true },
        { name: '👥 Member Count', value: `${thread.memberCount || 0}`, inline: true },
        { name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false }
      );

      embed.setFooter({ text: `Thread ID: ${thread.id}` });

      await sendAuditLog(thread.guild, {
        category: LogCategories.THREADS,
        embed,
      });
    } catch (error) {
      console.error('Error in threadDelete:', error);
    }
  },
};
