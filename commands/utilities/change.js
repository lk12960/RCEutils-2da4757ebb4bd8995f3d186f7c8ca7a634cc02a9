const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { refreshServicesBoard } = require('../../utils/servicesBoard');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('change')
    .setDescription('Owner/Management: Rescan service channels and update services status embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      await refreshServicesBoard(interaction.guild);
      await interaction.editReply({ content: '✅ Services board has been refreshed successfully!' });
    } catch (e) {
      console.error('change: refreshServicesBoard failed', e);
      await interaction.editReply({ content: `⚠️ Failed to refresh services board.\nError: ${e.message}` });
    }
  }
};
