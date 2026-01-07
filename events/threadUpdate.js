// events/threadUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'threadUpdate',

  async execute(oldThread, newThread) {
    try {
      const changes = [];

      // Name change
      if (oldThread.name !== newThread.name) {
        changes.push({ field: 'Name', old: oldThread.name, new: newThread.name });
      }

      // Archived state
      if (oldThread.archived !== newThread.archived) {
        changes.push({ field: 'Archived', old: oldThread.archived ? 'Yes' : 'No', new: newThread.archived ? 'Yes' : 'No' });
      }

      // Locked state
      if (oldThread.locked !== newThread.locked) {
        changes.push({ field: 'Locked', old: oldThread.locked ? 'Yes' : 'No', new: newThread.locked ? 'Yes' : 'No' });
      }

      // Auto archive duration
      if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
        changes.push({ field: 'Auto Archive', old: `${oldThread.autoArchiveDuration} min`, new: `${newThread.autoArchiveDuration} min` });
      }

      // Rate limit
      if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
        changes.push({ field: 'Slowmode', old: `${oldThread.rateLimitPerUser}s`, new: `${newThread.rateLimitPerUser}s` });
      }

      // If no changes, don't log
      if (changes.length === 0) return;

      // Try to find who made the change
      let executor = null;
      const entry = await findExecutor(newThread.guild, AuditLogEvent.ThreadUpdate, { id: newThread.id });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Thread Updated',
        emoji: LogEmojis.THREAD_UPDATE,
        color: LogColors.UPDATE,
      });

      embed.addFields(
        { name: '🧵 Thread', value: `${newThread.name} (<#${newThread.id}>)`, inline: false }
      );

      // Add changes
      for (const change of changes) {
        embed.addFields({ 
          name: `${change.field}`, 
          value: `\`${change.old}\` → \`${change.new}\``, 
          inline: true 
        });
      }

      if (executor) {
        embed.addFields({ name: '👮 Updated By', value: formatExecutor(executor), inline: false });
      }

      embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

      embed.setFooter({ text: `Thread ID: ${newThread.id}` });

      await sendAuditLog(newThread.guild, {
        category: LogCategories.THREADS,
        embed,
      });
    } catch (error) {
      console.error('Error in threadUpdate:', error);
    }
  },
};
