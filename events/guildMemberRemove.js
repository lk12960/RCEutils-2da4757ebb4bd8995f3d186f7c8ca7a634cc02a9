// events/guildMemberRemove.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp, findExecutor, formatExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildMemberRemove',

  async execute(member) {
    try { await (require('../utils/stats').track)('member_leave', 1, member.guild.id); } catch {}

    try {
      // Check if it was a kick or ban
      let wasKicked = false;
      let wasBanned = false;
      let executor = null;
      let reason = null;

      // Check for kick
      const kickEntry = await findExecutor(member.guild, AuditLogEvent.MemberKick, { id: member.id });
      if (kickEntry && Date.now() - kickEntry.createdTimestamp < 5000) {
        wasKicked = true;
        executor = kickEntry.executor;
        reason = kickEntry.reason;
      }

      // Check for ban
      if (!wasKicked) {
        const banEntry = await findExecutor(member.guild, AuditLogEvent.MemberBanAdd, { id: member.id });
        if (banEntry && Date.now() - banEntry.createdTimestamp < 5000) {
          wasBanned = true;
          executor = banEntry.executor;
          reason = banEntry.reason;
        }
      }

      // Filter roles to exclude @everyone and sort by position descending
      const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString())
        .slice(0, 10) // Limit to 10 roles
        .join(', ') || 'No roles';

      const roleCount = member.roles.cache.filter(role => role.id !== member.guild.id).size;
      const rolesDisplay = roleCount > 10 ? `${roles} (+${roleCount - 10} more)` : roles;

      // Calculate time in server
      const joinedAt = member.joinedTimestamp;
      const timeInServer = joinedAt ? Date.now() - joinedAt : 0;
      const daysInServer = Math.floor(timeInServer / (1000 * 60 * 60 * 24));

      const embed = createBaseEmbed({
        title: wasKicked ? 'Member Kicked' : wasBanned ? 'Member Banned' : 'Member Left',
        emoji: wasKicked ? LogEmojis.KICK : wasBanned ? LogEmojis.BAN : LogEmojis.MEMBER_LEAVE,
        color: wasKicked || wasBanned ? LogColors.CRITICAL : LogColors.MEMBER_LEAVE,
      });

      embed.addFields(
        { name: '👤 Member', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: '📅 Account Created', value: formatTimestamp(member.user.createdTimestamp, 'R'), inline: true },
        { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true }
      );

      if (joinedAt) {
        embed.addFields(
          { name: '📆 Joined Server', value: formatTimestamp(joinedAt, 'F'), inline: true },
          { name: '⏱️ Time in Server', value: `${daysInServer} day(s)`, inline: true }
        );
      }

      if (wasKicked || wasBanned) {
        embed.addFields({ 
          name: '👮 Moderator', 
          value: executor ? formatExecutor(executor) : 'Unknown', 
          inline: true 
        });
        if (reason) {
          embed.addFields({ name: '📝 Reason', value: reason, inline: false });
        }
      }

      embed.addFields({ name: '🎭 Roles', value: rolesDisplay, inline: false });

      // Check for boost status
      if (member.premiumSince) {
        embed.addFields({ 
          name: '💎 Server Booster', 
          value: `Was boosting since ${formatTimestamp(member.premiumSince, 'R')}`, 
          inline: false 
        });
      }

      // Nickname
      if (member.nickname) {
        embed.addFields({ name: '📝 Nickname', value: member.nickname, inline: true });
      }

      embed.addFields({ name: '⏰ Left', value: formatTimestamp(Date.now()), inline: false });

      if (member.user.avatarURL()) {
        embed.setThumbnail(member.user.avatarURL());
      }

      embed.setFooter({ text: `User ID: ${member.id}` });

      await sendAuditLog(member.guild, {
        category: wasKicked || wasBanned ? LogCategories.MODERATION : LogCategories.MEMBERS,
        embed,
      });
    } catch (error) {
      console.error('Failed to send guildMemberRemove log:', error);
    }
  },
};