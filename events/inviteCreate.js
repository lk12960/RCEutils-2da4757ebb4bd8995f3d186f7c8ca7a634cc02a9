// events/inviteCreate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, formatDuration } = require('../utils/auditLogger');

module.exports = {
  name: 'inviteCreate',

  async execute(invite) {
    try {
      const embed = createBaseEmbed({
        title: 'Invite Created',
        emoji: LogEmojis.INVITE_CREATE,
        color: LogColors.CREATE,
      });

      const inviter = invite.inviter;
      const channel = invite.channel;
      const expiresAt = invite.expiresTimestamp;
      const maxUses = invite.maxUses || 'Unlimited';
      const temporary = invite.temporary ? 'Yes' : 'No';

      embed.addFields(
        { name: '🎟️ Invite Code', value: `\`${invite.code}\`\n[discord.gg/${invite.code}](https://discord.gg/${invite.code})`, inline: false },
        { name: '👤 Created By', value: inviter ? formatExecutor(inviter) : 'Unknown', inline: true },
        { name: '📍 Channel', value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true }
      );

      if (expiresAt) {
        embed.addFields({ name: '⏰ Expires', value: formatTimestamp(expiresAt, 'R'), inline: true });
      } else {
        embed.addFields({ name: '⏰ Expires', value: 'Never', inline: true });
      }

      embed.addFields(
        { name: '🔢 Max Uses', value: `${maxUses}`, inline: true },
        { name: '🕐 Temporary', value: temporary, inline: true },
        { name: '📅 Created', value: formatTimestamp(invite.createdTimestamp), inline: true }
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
      console.error('Error in inviteCreate:', error);
    }
  },
};
