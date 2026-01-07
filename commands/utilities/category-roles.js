const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { listCategories } = require('../../utils/priceManager');
const { requireTier } = require('../../utils/permissions');
const { setCategoryRole, getCategoryRole } = require('../../utils/categoryRoleSync');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('category-roles')
    .setDescription('Map design categories to existing Discord roles (management only).'),
  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    const cats = await listCategories();
    if (!cats.length) {
      return interaction.editReply({ content: 'ℹ️ No categories found.' });
    }

    const catOptions = cats.map(c => ({ label: c, value: c }));
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId(`catrole_select:${interaction.user.id}`)
      .setPlaceholder('Select a category')
      .addOptions(catOptions);

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(`catrole_role:${interaction.user.id}`)
      .setPlaceholder('Choose a role for the selected category');

    const saveBtn = new ButtonBuilder().setCustomId(`catrole_save:${interaction.user.id}`).setLabel('Save Mapping').setStyle(ButtonStyle.Primary);

    const desc = 'Map a category to a role. First pick a category, then a role, then Save Mapping. Repeat as needed.';
    const embed = new EmbedBuilder().setTitle("Category ↔ Role Mapping").setDescription(desc).setColor(BRAND_COLOR_HEX);

    await interaction.editReply({ embeds: [embed], components: [
      new ActionRowBuilder().addComponents(categorySelect),
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(saveBtn)
    ]});
  }
};
