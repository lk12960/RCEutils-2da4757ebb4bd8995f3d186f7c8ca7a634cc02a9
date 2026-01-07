// events/guildMemberUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp, findExecutor, formatExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildMemberUpdate',

  async execute(oldMember, newMember) {
    try {
      let changes = [];
      let executor = null;

      // Check nickname changes
      if (oldMember.nickname !== newMember.nickname) {
        // Try to find who changed the nickname
        const entry = await findExecutor(newMember.guild, AuditLogEvent.MemberUpdate, { id: newMember.id });
        if (entry && Date.now() - entry.createdTimestamp < 5000) {
          executor = entry.executor;
        }

        const embed = createBaseEmbed({
          title: 'Nickname Changed',
          emoji: LogEmojis.MEMBER_NICKNAME,
          color: LogColors.UPDATE,
        });

        embed.addFields(
          { name: '👤 Member', value: `${newMember.user.tag} (${newMember.id})`, inline: true },
          { name: '📝 Old Nickname', value: oldMember.nickname || '*None*', inline: true },
          { name: '📝 New Nickname', value: newMember.nickname || '*None*', inline: true }
        );

        if (executor) {
          if (executor.id === newMember.id) {
            embed.addFields({ name: '👤 Changed By', value: 'Self', inline: true });
          } else {
            embed.addFields({ name: '👮 Changed By', value: formatExecutor(executor), inline: true });
          }
        }

        embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

        if (newMember.user.avatarURL()) {
          embed.setThumbnail(newMember.user.avatarURL());
        }

        embed.setFooter({ text: `User ID: ${newMember.id}` });

        await sendAuditLog(newMember.guild, {
          category: LogCategories.MEMBERS,
          embed,
        });
      }

      // Check roles added/removed
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      const removedRoles = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== newMember.guild.id);
      const addedRoles = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== newMember.guild.id);

      if (removedRoles.size > 0 || addedRoles.size > 0) {
        // Try to find who changed the roles
        const entry = await findExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, { id: newMember.id });
        if (entry && Date.now() - entry.createdTimestamp < 5000) {
          executor = entry.executor;
        }

        const embed = createBaseEmbed({
          title: 'Member Roles Updated',
          emoji: LogEmojis.MEMBER_ROLES,
          color: LogColors.UPDATE,
        });

        embed.addFields(
          { name: '👤 Member', value: `${newMember.user.tag} (${newMember.id})`, inline: false }
        );

        if (addedRoles.size > 0) {
          const rolesAdded = addedRoles.map(r => r.toString()).join(', ');
          embed.addFields({ name: '➕ Roles Added', value: rolesAdded, inline: false });
        }

        if (removedRoles.size > 0) {
          const rolesRemoved = removedRoles.map(r => r.toString()).join(', ');
          embed.addFields({ name: '➖ Roles Removed', value: rolesRemoved, inline: false });
        }

        if (executor) {
          embed.addFields({ name: '👮 Changed By', value: formatExecutor(executor), inline: true });
        }

        embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

        if (newMember.user.avatarURL()) {
          embed.setThumbnail(newMember.user.avatarURL());
        }

        embed.setFooter({ text: `User ID: ${newMember.id}` });

        await sendAuditLog(newMember.guild, {
          category: LogCategories.MEMBERS,
          embed,
        });
      }

      // Check for timeout changes
      if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        const entry = await findExecutor(newMember.guild, AuditLogEvent.MemberUpdate, { id: newMember.id });
        if (entry && Date.now() - entry.createdTimestamp < 5000) {
          executor = entry.executor;
        }

        const isTimedOut = newMember.communicationDisabledUntilTimestamp > Date.now();
        
        const embed = createBaseEmbed({
          title: isTimedOut ? 'Member Timed Out' : 'Member Timeout Removed',
          emoji: LogEmojis.TIMEOUT,
          color: isTimedOut ? LogColors.WARNING : LogColors.INFO,
        });

        embed.addFields(
          { name: '👤 Member', value: `${newMember.user.tag} (${newMember.id})`, inline: true }
        );

        if (isTimedOut) {
          embed.addFields({ 
            name: '⏰ Until', 
            value: formatTimestamp(newMember.communicationDisabledUntilTimestamp), 
            inline: true 
          });
        }

        if (executor) {
          embed.addFields({ name: '👮 By', value: formatExecutor(executor), inline: true });
        }

        if (entry?.reason) {
          embed.addFields({ name: '📝 Reason', value: entry.reason, inline: false });
        }

        embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

        if (newMember.user.avatarURL()) {
          embed.setThumbnail(newMember.user.avatarURL());
        }

        embed.setFooter({ text: `User ID: ${newMember.id}` });

        await sendAuditLog(newMember.guild, {
          category: LogCategories.MODERATION,
          embed,
        });
      }

      // Check for boost status changes
      if (oldMember.premiumSince !== newMember.premiumSince) {
        const isBoosting = newMember.premiumSince !== null;

        const embed = createBaseEmbed({
          title: isBoosting ? 'Member Started Boosting' : 'Member Stopped Boosting',
          emoji: LogEmojis.MEMBER_BOOST,
          color: isBoosting ? LogColors.CREATE : LogColors.DELETE,
        });

        embed.addFields(
          { name: '👤 Member', value: `${newMember.user.tag} (${newMember.id})`, inline: true },
          { name: '💎 Status', value: isBoosting ? '**Boosting**' : '**Not Boosting**', inline: true },
          { name: '📊 Boost Level', value: `Level ${newMember.guild.premiumTier}`, inline: true },
          { name: '💎 Total Boosts', value: `${newMember.guild.premiumSubscriptionCount || 0}`, inline: true }
        );

        if (isBoosting) {
          embed.addFields({ name: '⏰ Boosting Since', value: formatTimestamp(newMember.premiumSince), inline: true });
        }

        embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

        if (newMember.user.avatarURL()) {
          embed.setThumbnail(newMember.user.avatarURL());
        }

        embed.setFooter({ text: `User ID: ${newMember.id}` });

        await sendAuditLog(newMember.guild, {
          category: LogCategories.MEMBERS,
          embed,
        });
      }
    } catch (error) {
      console.error('Failed to send guildMemberUpdate log:', error);
    }
  },
};