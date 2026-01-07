const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botsetup')
    .setDescription("Owner/Management: Run King's Customs setup flows from one place")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to run setup.', flags: 64 });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });

    const banner = new EmbedBuilder()
      .setColor(BRAND_COLOR_HEX)
      .setImage('https://message.style/cdn/images/73c03054d041546292863ab6737c04d00e26b01bb9feb653a58b1ba7e37238c1.png');
    const welcome = new EmbedBuilder()
      .setTitle("Welcome to King's Customs Setup")
      .setDescription('Choose a setup flow from the dropdown below. You can run them multiple times if needed.')
      .setColor(BRAND_COLOR_HEX);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`botsetup_select:${interaction.user.id}`)
      .setPlaceholder('Select a setup to run')
      .addOptions([
        { label: 'Services Setup', value: 'services', description: 'Create services board and configuration' },
        { label: 'Orders Setup', value: 'orders', description: 'Configure orders category and logging channels' },
        { label: 'Support Setup', value: 'support', description: 'Create support panel and roles' },
      ]);

    await interaction.editReply({ embeds: [banner, welcome], components: [new ActionRowBuilder().addComponents(select)] });
  }
};
