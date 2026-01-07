const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Displays member counts with statuses'),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

    // Fetch all members (make sure you have the GUILD_MEMBERS intent)
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

    await interaction.reply({ embeds: [embed] });
  },
};