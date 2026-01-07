const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { seedDefaultsIfEmpty } = require('../../utils/priceManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prices-init')
    .setDescription('Owner/Management: Seed default prices if table empty')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const seeded = await seedDefaultsIfEmpty().catch(() => null);
    if (seeded === null) return interaction.editReply({ content: '❌ Error seeding defaults.' });
    return interaction.editReply({ content: seeded ? '✅ Defaults seeded.' : 'ℹ️ Prices table already initialized.' });
  }
};
