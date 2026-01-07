const { AuditLogEvent, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (oldRole.permissions.bitfield === newRole.permissions.bitfield) return;

    const guild = newRole.guild;
    const logChannel = guild.channels.cache.get(process.env.AUDIT_LOG_CHANNEL_ID);
    if (!logChannel?.isTextBased()) return;

    // Find who made the change
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
    const roleLog = fetchedLogs.entries.find(entry => entry.target.id === newRole.id);
    const executor = roleLog?.executor || { tag: 'Unknown', id: 'N/A' };

    // Compare permissions
    const oldPerms = new PermissionsBitField(oldRole.permissions);
    const newPerms = new PermissionsBitField(newRole.permissions);
    const added = newPerms.toArray().filter(p => !oldPerms.has(p));
    const removed = oldPerms.toArray().filter(p => !newPerms.has(p));

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('⚙️ Role Permissions Updated')
      .addFields(
        { name: '➜ Role', value: `${newRole.name} (${newRole.id})`, inline: true },
        { name: '➜ Changed By', value: `${executor.tag} (<@${executor.id}>)`, inline: true },
        added.length > 0 ? { name: '➕ Added Permissions', value: added.join(', '), inline: false } : null,
        removed.length > 0 ? { name: '➖ Removed Permissions', value: removed.join(', '), inline: false } : null
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(console.error);
  },
};
