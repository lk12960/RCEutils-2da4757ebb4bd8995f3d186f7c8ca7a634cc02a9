const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'membercount',
  description: 'Displays member counts with statuses',

  async execute(message, args) {
    const guild = message.guild;
    if (!guild) return message.reply('This command can only be used in a server.');

    // Fetch all members (make sure your bot has the GUILD_MEMBERS intent)
    await guild.members.fetch();

    const totalMembers = guild.memberCount;
    const bots = guild.members.cache.filter(member => member.user.bot).size;
    const onlineMembers = guild.members.cache.filter(
      m => !m.user.bot && ['online', 'idle', 'dnd'].includes(m.presence?.status)
    ).size;
    const offlineMembers = guild.members.cache.filter(
      m => !m.user.bot && (!m.presence || m.presence.status === 'offline')
    ).size;

    const embed = new EmbedBuilder()
      .setTitle(`Member Count for ${guild.name}`)
      .setColor(0x00AE86)
      .addFields(
        { name: 'Online Members', value: `${onlineMembers}`, inline: true },
        { name: 'Offline Members', value: `${offlineMembers}`, inline: true },
        { name: 'Bots', value: `${bots}`, inline: true },
        { name: 'Total Members', value: `${totalMembers}`, inline: true },
      )
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  },
};