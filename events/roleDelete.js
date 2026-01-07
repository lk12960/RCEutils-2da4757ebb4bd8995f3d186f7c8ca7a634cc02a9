// events/roleDelete.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'roleDelete',

  async execute(role) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = role.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let executor = 'Unknown';
    try {
      const auditLogs = await role.guild.fetchAuditLogs({ type: 'ROLE_DELETE', limit: 1 });
      const entry = auditLogs.entries.first();
      if (entry && entry.target.id === role.id) {
        executor = entry.executor.tag;
      }
    } catch {
      // ignore
    }

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Role Deleted')
      .setColor(0xe74c3c)
      .addFields(
        { name: 'Role Name', value: role.name, inline: true },
        { name: 'Role Color', value: role.hexColor, inline: true },
        { name: 'Permissions', value: PermissionsBitField.resolve(role.permissions).toArray().join(', ') || 'None', inline: false },
        { name: 'Deleted By', value: executor, inline: true },
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send roleDelete log:', error);
    }
  },
};
