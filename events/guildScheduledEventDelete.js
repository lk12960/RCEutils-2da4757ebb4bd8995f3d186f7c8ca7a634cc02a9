// events/guildScheduledEventDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildScheduledEventDelete',

  async execute(event) {
    try {
      // Try to find who deleted the event
      let executor = null;
      const entry = await findExecutor(event.guild, AuditLogEvent.GuildScheduledEventDelete, { id: event.id });

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Scheduled Event Deleted',
        emoji: LogEmojis.EVENT_DELETE,
        color: LogColors.DELETE,
      });

      const creator = event.creator;

      embed.addFields(
        { name: '📅 Event Name', value: event.name, inline: false },
        { name: '👤 Created By', value: creator ? formatExecutor(creator) : 'Unknown', inline: true },
        { name: '🗑️ Deleted By', value: executor ? formatExecutor(executor) : 'Unknown', inline: true }
      );

      if (event.description) {
        embed.addFields({ name: '📝 Description', value: event.description.slice(0, 1024), inline: false });
      }

      embed.addFields({ name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false });

      embed.setFooter({ text: `Event ID: ${event.id}` });

      await sendAuditLog(event.guild, {
        category: LogCategories.EVENTS,
        embed,
      });
    } catch (error) {
      console.error('Error in guildScheduledEventDelete:', error);
    }
  },
};
