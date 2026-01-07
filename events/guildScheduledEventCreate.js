// events/guildScheduledEventCreate.js
const { EmbedBuilder, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp } = require('../utils/auditLogger');

module.exports = {
  name: 'guildScheduledEventCreate',

  async execute(event) {
    try {
      const embed = createBaseEmbed({
        title: 'Scheduled Event Created',
        emoji: LogEmojis.EVENT_CREATE,
        color: LogColors.CREATE,
      });

      const creator = event.creator;
      const entityType = event.entityType === GuildScheduledEventEntityType.StageInstance ? 'Stage Channel' :
                        event.entityType === GuildScheduledEventEntityType.Voice ? 'Voice Channel' :
                        event.entityType === GuildScheduledEventEntityType.External ? 'External' : 'Unknown';

      embed.addFields(
        { name: '📅 Event Name', value: event.name, inline: false },
        { name: '👤 Created By', value: creator ? formatExecutor(creator) : 'Unknown', inline: true },
        { name: '📍 Type', value: entityType, inline: true }
      );

      if (event.channel) {
        embed.addFields({ name: '🔊 Channel', value: `<#${event.channel.id}>`, inline: true });
      }

      if (event.entityMetadata?.location) {
        embed.addFields({ name: '🌍 Location', value: event.entityMetadata.location, inline: true });
      }

      embed.addFields(
        { name: '🕐 Starts', value: formatTimestamp(event.scheduledStartTimestamp), inline: true },
        { name: '🕐 Ends', value: event.scheduledEndTimestamp ? formatTimestamp(event.scheduledEndTimestamp) : 'Not set', inline: true }
      );

      if (event.description) {
        embed.addFields({ name: '📝 Description', value: event.description.slice(0, 1024), inline: false });
      }

      if (event.coverImageURL()) {
        embed.setImage(event.coverImageURL());
      }

      if (creator?.avatarURL()) {
        embed.setThumbnail(creator.avatarURL());
      }

      embed.setFooter({ text: `Event ID: ${event.id}` });

      await sendAuditLog(event.guild, {
        category: LogCategories.EVENTS,
        embed,
      });
    } catch (error) {
      console.error('Error in guildScheduledEventCreate:', error);
    }
  },
};
