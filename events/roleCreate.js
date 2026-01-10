// events/roleCreate.js
const { EmbedBuilder, PermissionsBitField, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'roleCreate',

  async execute(role) {
    try {
      // Find who created the role
      const entry = await findExecutor(role.guild, AuditLogEvent.RoleCreate, { id: role.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Role Created',
        emoji: LogEmojis.ROLE_CREATE,
        color: role.color || LogColors.CREATE,
      });

      embed.addFields(
        { name: '🎭 Role', value: `${role.name} (<@&${role.id}>)`, inline: true },
        { name: '🎨 Color', value: role.hexColor, inline: true },
        { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Created By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields(
        { name: '📢 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: '📊 Display Separately', value: role.hoist ? 'Yes' : 'No', inline: true },
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

      embed.addFields({ name: '⏰ Created', value: formatTimestamp(Date.now()), inline: false });
      embed.setFooter({ text: `Role ID: ${role.id}` });

      await sendAuditLog(role.guild, {
        category: LogCategories.ROLES,
        embed,
      });
    } catch (error) {
      console.error('Failed to log roleCreate:', error);
    }
  },
};
