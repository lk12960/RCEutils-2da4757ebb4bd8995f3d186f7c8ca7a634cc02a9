// events/roleUpdate.js
const { EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'roleUpdate',

  async execute(oldRole, newRole) {
    const guild = newRole.guild;

    try {
      // Try to find who updated the role
      const entry = await findExecutor(guild, AuditLogEvent.RoleUpdate, { id: newRole.id });
      let executor = null;
      if (entry) {
        executor = entry.executor;
      }

      const changes = [];

      // Check name change
      if (oldRole.name !== newRole.name) {
        changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
      }

      // Check color change
      if (oldRole.color !== newRole.color) {
        changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
      }

      // Check hoist change
      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`**Display Separately:** ${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);
      }

      // Check mentionable change
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`**Mentionable:** ${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`);
      }

      // Check position change
      if (oldRole.position !== newRole.position) {
        changes.push(`**Position:** ${oldRole.position} → ${newRole.position}`);
      }

      // Check permissions change
      const oldPerms = new PermissionsBitField(oldRole.permissions);
      const newPerms = new PermissionsBitField(newRole.permissions);
      
      if (!oldPerms.equals(newPerms)) {
        const addedPerms = newPerms.toArray().filter(p => !oldPerms.has(p));
        const removedPerms = oldPerms.toArray().filter(p => !newPerms.has(p));
        
        if (addedPerms.length > 0) {
          changes.push(`**Permissions Added:** ${addedPerms.join(', ')}`);
        }
        if (removedPerms.length > 0) {
          changes.push(`**Permissions Removed:** ${removedPerms.join(', ')}`);
        }
      }

      // If no changes detected, return
      if (changes.length === 0) return;

      const embed = createBaseEmbed({
        title: 'Role Updated',
        emoji: LogEmojis.ROLE_UPDATE,
        color: newRole.color || LogColors.UPDATE,
      });

      embed.addFields(
        { name: '🎭 Role', value: `${newRole.name} (<@&${newRole.id}>)`, inline: true },
        { name: '🆔 Role ID', value: `\`${newRole.id}\``, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👤 Updated By', value: formatExecutor(executor), inline: true });
      }

      embed.addFields({ 
        name: '📝 Changes', 
        value: changes.join('\n'), 
        inline: false 
      });

      embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

      embed.setFooter({ text: `Role ID: ${newRole.id}` });

      await sendAuditLog(guild, {
        category: LogCategories.ROLES,
        embed,
      });
    } catch (error) {
      console.error('Error in roleUpdate:', error);
    }
  },
};
