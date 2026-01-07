const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const infractionManager = require('../utils/infractionManager');

const ITEMS_PER_PAGE = 10;

module.exports = {
  name: 'myinfractions',
  description: 'View your own infractions with pagination',
  async execute(message, args) {
    const user = message.author;

    const infractions = await infractionManager.getInfractionsByUserId(user.id);
    if (!infractions || infractions.length === 0) {
      return message.reply('ℹ️ You have no infractions.');
    }

    let page = 0;
    const totalPages = Math.ceil(infractions.length / ITEMS_PER_PAGE);

    const generateEmbed = (pageIndex) => {
      const slice = infractions.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);
      const embed = new EmbedBuilder()
        .setTitle('Your Infractions')
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

    const sentMessage = await message.channel.send({
      embeds: [generateEmbed(page)],
      components: [row],
    });

    const collector = sentMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000, // 2 minutes
      filter: i => i.user.id === user.id,
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
        await sentMessage.edit({ components: [disabledRow] });
      } catch (err) {
        // message might be deleted or no permissions
      }
    });
  },
};
