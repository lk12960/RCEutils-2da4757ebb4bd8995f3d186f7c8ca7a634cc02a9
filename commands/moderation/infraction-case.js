const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getInfractionById } = require('../../utils/infractionManager');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-case')
    .setDescription('View details of an infraction by its case ID')
    .addIntegerOption(option =>
      option.setName('id').setDescription('Infraction case ID').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const caseId = interaction.options.getInteger('id');
    const infraction = await getInfractionById(caseId);

    if (!infraction) {
      return interaction.reply({ content: `❌ Infraction #${caseId} not found.`, ephemeral: true });
    }

    const timestamp = new Date(infraction.timestamp);
    const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor(infraction.revoked ? 0x808080 : 0x3a5ae4) // Gray if revoked, blue otherwise
      .setTitle(`Infraction Case #${infraction.id} ${infraction.revoked ? ' (Revoked)' : ''}`)
      .addFields(
        { name: 'User ID', value: `<@${infraction.user_id}>`, inline: true },
        { name: 'Moderator ID', value: `<@${infraction.moderator_id}>`, inline: true },
        { name: 'Type', value: infraction.type, inline: true },
        { name: 'Reason', value: infraction.reason || 'No reason provided', inline: false },
        { name: 'Notes', value: infraction.notes || 'None', inline: false },
        { name: 'Date Issued', value: formattedDate, inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};