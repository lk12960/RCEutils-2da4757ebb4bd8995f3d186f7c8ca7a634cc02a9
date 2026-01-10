// events/roleDelete.js
const { EmbedBuilder, PermissionsBitField, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'roleDelete',

  async execute(role) {
    try {
      // Find who deleted the role
      const entry = await findExecutor(role.guild, AuditLogEvent.RoleDelete, { id: role.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Role Deleted',
        emoji: LogEmojis.ROLE_DELETE,
        color: LogColors.DELETE,
      });

      embed.addFields(
        { name: '🎭 Role Name', value: role.name, inline: true },
        { name: '🎨 Color', value: role.hexColor, inline: true },
        { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Deleted By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields(
        { name: '📢 Was Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: '📊 Was Displayed Separately', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: '📍 Position', value: `${role.position}`, inline: true }
      );

      const permissions = new PermissionsBitField(role.permissions).toArray();
      if (permissions.length > 0) {
        const permList = permissions.slice(0, 20).join(', ');
        const permDisplay = permissions.length > 20 ? `${permList} (+${permissions.length - 20} more)` : permList;
        embed.addFields({ name: '🔑 Permissions', value: permDisplay, inline: false });
      } else {
        embed.addFields({ name: '🔑 Permissions', value: 'None', inline: false });
      }

      embed.addFields({ name: '⏰ Deleted', value: formatTimestamp(Date.now()), inline: false });
      embed.setFooter({ text: `Role ID: ${role.id}` });

      await sendAuditLog(role.guild, {
        category: LogCategories.ROLES,
        embed,
      });
    } catch (error) {
      console.error('Failed to log roleDelete:', error);
    }
  },
};
