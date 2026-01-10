// events/channelUpdate.js
const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor, truncate } = require('../utils/auditLogger');

module.exports = {
  name: 'channelUpdate',

  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;

    try {
      // Find who updated the channel
      const entry = await findExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, { id: newChannel.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      // Detect changes
      const changes = [];

      // Name change
      if (oldChannel.name !== newChannel.name) {
        changes.push(`**Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
      }

      // Topic change (text channels)
      if ('topic' in oldChannel && oldChannel.topic !== newChannel.topic) {
        const oldTopic = oldChannel.topic ? truncate(oldChannel.topic, 100) : '*None*';
        const newTopic = newChannel.topic ? truncate(newChannel.topic, 100) : '*None*';
        changes.push(`**Topic:**\n• Before: ${oldTopic}\n• After: ${newTopic}`);
      }

      // NSFW change
      if ('nsfw' in oldChannel && oldChannel.nsfw !== newChannel.nsfw) {
        changes.push(`**NSFW:** ${oldChannel.nsfw ? 'Yes' : 'No'} → ${newChannel.nsfw ? 'Yes' : 'No'}`);
      }

      // Slowmode change
      if ('rateLimitPerUser' in oldChannel && oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        changes.push(`**Slowmode:** ${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`);
      }

      // Bitrate change (voice channels)
      if ('bitrate' in oldChannel && oldChannel.bitrate !== newChannel.bitrate) {
        changes.push(`**Bitrate:** ${oldChannel.bitrate / 1000}kbps → ${newChannel.bitrate / 1000}kbps`);
      }

      // User limit change (voice channels)
      if ('userLimit' in oldChannel && oldChannel.userLimit !== newChannel.userLimit) {
        const oldLimit = oldChannel.userLimit || 'Unlimited';
        const newLimit = newChannel.userLimit || 'Unlimited';
        changes.push(`**User Limit:** ${oldLimit} → ${newLimit}`);
      }

      // Parent change (moved to different category)
      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent ? oldChannel.parent.name : 'None';
        const newParent = newChannel.parent ? newChannel.parent.name : 'None';
        changes.push(`**Category:** ${oldParent} → ${newParent}`);
      }

      // Position change
      if (oldChannel.position !== newChannel.position) {
        changes.push(`**Position:** ${oldChannel.position} → ${newChannel.position}`);
      }

      // Region override (voice channels)
      if ('rtcRegion' in oldChannel && oldChannel.rtcRegion !== newChannel.rtcRegion) {
        const oldRegion = oldChannel.rtcRegion || 'Automatic';
        const newRegion = newChannel.rtcRegion || 'Automatic';
        changes.push(`**Region:** ${oldRegion} → ${newRegion}`);
      }

      // Skip logging if nothing changed
      if (changes.length === 0) return;

      const embed = createBaseEmbed({
        title: 'Channel Updated',
        emoji: LogEmojis.CHANNEL_UPDATE,
        color: LogColors.UPDATE,
      });

      embed.addFields(
        { name: '📝 Channel', value: `${newChannel.name} (<#${newChannel.id}>)`, inline: true },
        { name: '🆔 ID', value: `\`${newChannel.id}\``, inline: true }
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
      embed.setFooter({ text: `Channel ID: ${newChannel.id}` });

      await sendAuditLog(newChannel.guild, {
        category: LogCategories.CHANNELS,
        embed,
      });
    } catch (error) {
      console.error('Failed to log channelUpdate:', error);
    }
  },
};