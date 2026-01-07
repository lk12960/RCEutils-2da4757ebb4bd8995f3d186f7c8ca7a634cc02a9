const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { getAllTiers, initCacheForGuild } = require('../../utils/rolesManager');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permissions-list')
    .setDescription('Owner/Management: Show current permission role mapping')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }

    await initCacheForGuild(interaction.guild.id);
    const map = getAllTiers(interaction.guild.id);

    const pretty = Object.keys(map).length
      ? Object.entries(map).map(([t, r]) => `• ${t}: <@&${r}>`).join('\n')
      : 'No custom mapping found. Using environment fallbacks.';

    const embed = new EmbedBuilder()
      .setTitle("King's Customs Permission Tiers")
      .setColor(BRAND_COLOR_HEX)
      .setDescription(pretty);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
