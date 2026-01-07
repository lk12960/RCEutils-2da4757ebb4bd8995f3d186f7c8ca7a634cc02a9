// events/threadCreate.js
const { EmbedBuilder, ChannelType } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp } = require('../utils/auditLogger');

module.exports = {
  name: 'threadCreate',

  async execute(thread, newlyCreated) {
    // Only log if it was newly created (not just added to cache)
    if (!newlyCreated) return;

    try {
      const owner = await thread.fetchOwner().catch(() => null);

      const embed = createBaseEmbed({
        title: 'Thread Created',
        emoji: LogEmojis.THREAD_CREATE,
        color: LogColors.CREATE,
      });

      const threadType = thread.type === ChannelType.PublicThread ? 'Public' : 
                         thread.type === ChannelType.PrivateThread ? 'Private' : 
                         thread.type === ChannelType.AnnouncementThread ? 'Announcement' : 
                         'Unknown';

      embed.addFields(
        { name: '🧵 Thread Name', value: `${thread.name} (<#${thread.id}>)`, inline: false },
        { name: '👤 Created By', value: owner ? formatExecutor(owner.user) : 'Unknown', inline: true },
        { name: '📂 Type', value: threadType, inline: true },
        { name: '📍 Parent Channel', value: thread.parent ? `<#${thread.parent.id}>` : 'Unknown', inline: true }
      );

      if (thread.autoArchiveDuration) {
        embed.addFields({ name: '🕐 Auto Archive', value: `${thread.autoArchiveDuration} minutes`, inline: true });
      }

      embed.addFields(
        { name: '🔒 Locked', value: thread.locked ? 'Yes' : 'No', inline: true },
        { name: '📦 Archived', value: thread.archived ? 'Yes' : 'No', inline: true },
        { name: '⏰ Created', value: formatTimestamp(thread.createdTimestamp), inline: false }
      );

      if (owner?.user?.avatarURL()) {
        embed.setThumbnail(owner.user.avatarURL());
      }

      embed.setFooter({ text: `Thread ID: ${thread.id}` });

      await sendAuditLog(thread.guild, {
        category: LogCategories.THREADS,
        embed,
      });
    } catch (error) {
      console.error('Error in threadCreate:', error);
    }
  },
};
