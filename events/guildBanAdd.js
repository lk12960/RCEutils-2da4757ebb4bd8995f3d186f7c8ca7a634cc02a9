// events/guildBanAdd.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildBanAdd',

  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;

    try {
      // Fetch audit log to get ban reason and executor
      const entry = await findExecutor(guild, AuditLogEvent.MemberBanAdd, { id: user.id });

      let executor = null;
      let reason = 'No reason provided';

      if (entry) {
        executor = entry.executor;
        reason = entry.reason || 'No reason provided';
      }

      const embed = createBaseEmbed({
        title: 'Member Banned',
        emoji: LogEmojis.BAN,
        color: LogColors.BAN,
      });

      embed.addFields(
        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
        { name: '📅 Account Created', value: formatTimestamp(user.createdTimestamp, 'R'), inline: true },
        { name: '👮 Banned By', value: executor ? formatExecutor(executor) : 'Unknown', inline: false },
        { name: '📝 Reason', value: reason, inline: false },
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
      console.error('Error in guildBanAdd:', error);
    }
  },
};
