// events/guildBanRemove.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildBanRemove',

  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;

    try {
      // Fetch audit log to get unban executor
      const entry = await findExecutor(guild, AuditLogEvent.MemberBanRemove, { id: user.id });

      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Member Unbanned',
        emoji: LogEmojis.UNBAN,
        color: LogColors.UNBAN,
      });

      embed.addFields(
        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
        { name: '📅 Account Created', value: formatTimestamp(user.createdTimestamp, 'R'), inline: true },
        { name: '👮 Unbanned By', value: executor ? formatExecutor(executor) : 'Unknown', inline: false },
        { name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false }
      );

      if (user.avatarURL()) {
        embed.setThumbnail(user.avatarURL());
      }

      embed.setFooter({ text: `User ID: ${user.id}` });

      await sendAuditLog(guild, {
        category: LogCategories.MODERATION,
        embed,
      });
    } catch (error) {
      console.error('Error in guildBanRemove:', error);
    }
  },
};
