const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getCaseById } = require('../../utils/caseManager');
const { isModerator } = require('../../utils/permissions'); // your custom permission check

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View details of a moderation case by its ID')
    .addIntegerOption(option =>
      option.setName('id').setDescription('Case ID').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const member = interaction.member;

    // Use the isModerator function for permission check
    if (!isModerator(member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const caseId = interaction.options.getInteger('id');
    const modCase = await getCaseById(caseId);

    if (!modCase) {
      return interaction.reply({
        content: `❌ Case #${caseId} not found.`,
        ephemeral: true,
      });
    }

    const timestamp = new Date(modCase.timestamp);
    const crossedOut = (text) => `~~${text}~~`;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`~~📁 Case #${modCase.id}~~ 🟡Case #${modCase.id} voided`)
      .addFields(
        { name: '➜ Type', value: crossedOut(modCase.action), inline: true },
        { name: '➜ User', value: crossedOut(`<@${modCase.user_id}>`), inline: true },
        { name: '➜ Moderator', value: crossedOut(`<@${modCase.moderator_id}>`), inline: true },
        { name: '➜ Reason', value: crossedOut(modCase.reason || 'No reason provided'), inline: false },
        { name: '➜ Date', value: crossedOut(`<t:${Math.floor(timestamp.getTime() / 1000)}:F>`), inline: false }
      )
      .setFooter({ text: `Case ID: ${modCase.id} • ${timestamp.toUTCString()}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};