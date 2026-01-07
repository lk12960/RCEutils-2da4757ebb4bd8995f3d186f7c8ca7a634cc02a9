// events/inviteDelete.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'inviteDelete',

  async execute(invite) {
    try {
      // Try to find who deleted the invite
      let executor = null;
      const entry = await findExecutor(invite.guild, AuditLogEvent.InviteDelete, (e) => e.target?.code === invite.code);

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Invite Deleted',
        emoji: '🎟️',
        color: LogColors.DELETE,
      });

      const inviter = invite.inviter;
      const channel = invite.channel;
      const uses = invite.uses || 0;

      embed.addFields(
        { name: '🎟️ Invite Code', value: `\`${invite.code}\` (discord.gg/${invite.code})`, inline: false },
        { name: '👤 Originally Created By', value: inviter ? formatExecutor(inviter) : 'Unknown', inline: true },
        { name: '🗑️ Deleted By', value: executor ? formatExecutor(executor) : 'Unknown', inline: true }
      );

      if (channel) {
        embed.addFields({ name: '📍 Channel', value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true });
      }

      embed.addFields(
        { name: '🔢 Total Uses', value: `${uses}`, inline: true },
        { name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: true }
      );

      if (inviter?.avatarURL()) {
        embed.setThumbnail(inviter.avatarURL());
      }

      embed.setFooter({ text: `Invite Code: ${invite.code}` });

      await sendAuditLog(invite.guild, {
        category: LogCategories.INVITES,
        embed,
      });
    } catch (error) {
      console.error('Error in inviteDelete:', error);
    }
  },
};
