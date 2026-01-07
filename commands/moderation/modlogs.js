const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { getCasesByUserId } = require('../../utils/caseManager');
const { isModerator } = require('../../utils/permissions');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View all moderation logs for a user, paginated')
    .addUserOption(option =>
      option.setName('user').setDescription('User to view logs for').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const cases = await getCasesByUserId(user.id);

    if (!cases || cases.length === 0) {
      return interaction.reply({ content: `📁 No moderation logs found for ${user.tag}.`, ephemeral: true });
    }

    const casesPerPage = 5;
    let page = 0;
    const totalPages = Math.ceil(cases.length / casesPerPage);

    // Helper to cross out text only if voided
    const formatValue = (text, isVoided) => isVoided ? `~~${text}~~` : text;

    const generateEmbed = (page) => {
      const start = page * casesPerPage;
      const pageCases = cases.slice(start, start + casesPerPage);

      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(`📄 Moderation Logs for ${user.tag}`)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} • Total Cases: ${cases.length}` });

      for (const modCase of pageCases) {
        const voided = !!modCase.voided; // boolean flag if the case is voided
        const timestamp = new Date(modCase.timestamp);

        embed.addFields(
          { name: '➜ Type', value: formatValue(modCase.action, voided), inline: true },
          { name: '➜ User', value: formatValue(`<@${modCase.user_id}>`, voided), inline: true },
          { name: '➜ Moderator', value: formatValue(`<@${modCase.moderator_id}>`, voided), inline: true },
          { name: '➜ Reason', value: formatValue(modCase.reason || 'No reason provided', voided), inline: false },
          { name: '➜ Date', value: formatValue(`<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, voided), inline: false }
        );
      }

      return embed;
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('previous')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true), // initially disabled
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(totalPages <= 1)
    );

    const message = await interaction.reply({
      embeds: [generateEmbed(page)],
      components: [row],
      fetchReply: true,
      ephemeral: true,
    });

    if (totalPages <= 1) return; // no need for pagination

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000, // 5 minutes
    });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({ content: "These buttons aren't for you!", ephemeral: true });
      }

      if (btnInteraction.customId === 'previous') {
        page--;
      } else if (btnInteraction.customId === 'next') {
        page++;
      }

      // Clamp page number
      if (page < 0) page = 0;
      if (page >= totalPages) page = totalPages - 1;

      // Update buttons disabled state
      row.components[0].setDisabled(page === 0);
      row.components[1].setDisabled(page === totalPages - 1);

      await btnInteraction.update({ embeds: [generateEmbed(page)], components: [row] });
    });

    collector.on('end', () => {
      // Disable buttons after timeout
      row.components.forEach(button => button.setDisabled(true));
      message.edit({ components: [row] }).catch(() => {});
    });
  },
};
