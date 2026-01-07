const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { getSetting } = require('../../utils/settingsManager');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
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

    const servicesChannelId = await getSetting('services_channel_id');
    const servicesMessageId = await getSetting('services_message_id');
    const categoryId = await getSetting('services_category_id');

    if (!servicesChannelId || !servicesMessageId || !categoryId) {
      return interaction.editReply({ content: '❌ Setup not found. Run /setupbot first.' });
    }

    const category = interaction.guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: '❌ Services category missing.' });
    }

    try {
      await refreshServicesBoard(interaction.guild);
      await interaction.editReply({ content: '✅ Services board refreshed.' });
    } catch (e) {
      console.error('change: refreshServicesBoard failed', e);
      await interaction.editReply({ content: '⚠️ Failed to refresh services board.' });
    }
  }
};
