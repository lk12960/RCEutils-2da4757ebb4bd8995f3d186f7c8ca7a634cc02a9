// events/roleCreate.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'roleCreate',

  async execute(role) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = role.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Try to fetch audit logs to get who created the role
    let executor = 'Unknown';
    try {
      const auditLogs = await role.guild.fetchAuditLogs({ type: 'ROLE_CREATE', limit: 1 });
      const entry = auditLogs.entries.first();
      if (entry && entry.target.id === role.id) {
        executor = entry.executor.tag;
      }
    } catch {
      // Ignore errors here
    }

    const embed = new EmbedBuilder()
      .setTitle('🆕 Role Created')
      .setColor(role.color || 0x2ecc71)
      .addFields(
        { name: 'Role Name', value: role.name, inline: true },
        { name: 'Role Color', value: role.hexColor, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Permissions', value: new PermissionsBitField(role.permissions).toArray().join(', ') || 'None', inline: false },
        { name: 'Created By', value: executor, inline: true },
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send roleCreate log:', error);
    }
  },
};
