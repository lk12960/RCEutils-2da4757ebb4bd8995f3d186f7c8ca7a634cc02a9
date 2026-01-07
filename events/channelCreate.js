// events/channelCreate.js
const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'channelCreate',

  async execute(channel) {
    if (!channel.guild) return;

    try {
      // Find who created the channel
      const entry = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, { id: channel.id });
      let executor = entry?.executor;

      const channelTypes = {
        [ChannelType.GuildText]: 'Text Channel',
        [ChannelType.GuildVoice]: 'Voice Channel',
        [ChannelType.GuildCategory]: 'Category',
        [ChannelType.GuildAnnouncement]: 'Announcement Channel',
        [ChannelType.AnnouncementThread]: 'Announcement Thread',
        [ChannelType.PublicThread]: 'Public Thread',
        [ChannelType.PrivateThread]: 'Private Thread',
        [ChannelType.GuildStageVoice]: 'Stage Channel',
        [ChannelType.GuildForum]: 'Forum Channel',
      };

      const embed = createBaseEmbed({
        title: 'Channel Created',
        emoji: LogEmojis.CHANNEL_CREATE,
        color: LogColors.CREATE,
      });

      embed.addFields(
        { name: '📝 Name', value: `${channel.name} (<#${channel.id}>)`, inline: true },
        { name: '📂 Type', value: channelTypes[channel.type] || 'Unknown', inline: true },
        { name: '🆔 ID', value: `\`${channel.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Created By', value: formatExecutor(executor), inline: true });
      }

      // Category
      if (channel.parent) {
        embed.addFields({ name: '📁 Category', value: channel.parent.name, inline: true });
      }

      // Position
      embed.addFields({ name: '📊 Position', value: `${channel.position}`, inline: true });

      // Additional details based on type
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        if (channel.topic) {
          embed.addFields({ name: '📋 Topic', value: channel.topic.slice(0, 1024), inline: false });
        }
        embed.addFields(
          { name: '🔞 NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
          { name: '⏱️ Slowmode', value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : 'None', inline: true }
        );
      }

      if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        embed.addFields(
          { name: '👥 User Limit', value: channel.userLimit || 'Unlimited', inline: true },
          { name: '🎵 Bitrate', value: `${channel.bitrate / 1000}kbps`, inline: true }
        );
      }

      embed.addFields({ name: '⏰ Created', value: formatTimestamp(channel.createdTimestamp), inline: false });

      embed.setFooter({ text: `Channel ID: ${channel.id}` });

      await sendAuditLog(channel.guild, {
        category: LogCategories.CHANNELS,
        embed,
      });
    } catch (error) {
      console.error('Failed to log channelCreate:', error);
    }
  },
};