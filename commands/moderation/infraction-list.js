 const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const infractionManager = require('../../utils/infractionManager');
const { isManagement } = require('../../utils/permissions');

const ITEMS_PER_PAGE = 10;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-list')
    .setDescription('List all infractions for a user with pagination')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to list infractions for')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    if (!user) {
      return interaction.reply({ content: '❌ Invalid user.', ephemeral: true });
    }

    const infractions = await infractionManager.getInfractionsByUserId(user.id);
    if (!infractions || infractions.length === 0) {
      return interaction.reply({ content: `ℹ️ No infractions found for ${user.tag}.`, ephemeral: true });
    }

    let page = 0;
    const totalPages = Math.ceil(infractions.length / ITEMS_PER_PAGE);

    const generateEmbed = (pageIndex) => {
      const slice = infractions.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);
      const embed = new EmbedBuilder()
        .setTitle(`Infractions for ${user.tag}`)
        .setColor(0x3a5ae4)
        .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` });

      slice.forEach(infraction => {
        const caseId = infraction.revoked ? `~~#${infraction.id}~~ (Revoked)` : `#${infraction.id}`;
        const date = `<t:${Math.floor(new Date(infraction.timestamp).getTime() / 1000)}:F>`;
        const reason = infraction.reason || 'No reason provided';
        embed.addFields({
          name: `${caseId} - ${infraction.type}`,
          value: `Date: ${date}\nReason: ${reason}`,
          inline: false,
        });
      });

      return embed;
    };

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1),
      );

    await interaction.reply({ embeds: [generateEmbed(page)], components: [row], ephemeral: true });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000, // 2 minutes
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async i => {
      if (i.customId === 'prev' && page > 0) {
        page--;
      } else if (i.customId === 'next' && page < totalPages - 1) {
        page++;
      } else {
        await i.deferUpdate();
        return;
      }

      const newRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1),
        );

      await i.update({ embeds: [generateEmbed(page)], components: [newRow] });
    });

    collector.on('end', async () => {
      try {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
          );
        await interaction.editReply({ components: [disabledRow] });
      } catch {}
    });
  },
};
