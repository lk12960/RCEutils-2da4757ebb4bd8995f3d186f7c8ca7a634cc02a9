const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adduser')
    .setDescription('Add a user to this ticket channel')
    .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    try {
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      return interaction.reply({ content: `✅ Added ${user} to this ticket.`, ephemeral: true });
    } catch (e) {
      console.error('adduser error:', e);
      return interaction.reply({ content: '❌ Failed to add user to this ticket.', ephemeral: true });
    }
  }
};
