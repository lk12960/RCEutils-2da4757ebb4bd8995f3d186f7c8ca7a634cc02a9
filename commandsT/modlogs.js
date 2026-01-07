const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { getCasesByUserId } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

module.exports = {
  name: 'modlogs',
  description: 'View all moderation logs for a user, paginated',

  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const user = message.mentions.users.first() || (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null);
    if (!user) {
      return message.reply('❌ Please mention a valid user or provide a user ID.');
    }

    const cases = await getCasesByUserId(user.id);
    if (!cases || cases.length === 0) {
      return message.reply(`📁 No moderation logs found for ${user.tag}.`);
    }

    const casesPerPage = 5;
    let page = 0;
    const totalPages = Math.ceil(cases.length / casesPerPage);

    const formatValue = (text, isVoided) => isVoided ? `~~${text}~~` : text;

    const generateEmbed = (page) => {
      const start = page * casesPerPage;
      const pageCases = cases.slice(start, start + casesPerPage);

      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(`📄 Moderation Logs for ${user.tag}`)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} • Total Cases: ${cases.length}` });

      for (const modCase of pageCases) {
        const voided = !!modCase.voided;
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
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(totalPages <= 1)
    );

    const sentMessage = await message.channel.send({
      embeds: [generateEmbed(page)],
      components: [row],
    });

    if (totalPages <= 1) return; // no pagination needed

    const collector = sentMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000, // 5 minutes
    });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== message.author.id) {
        return btnInteraction.reply({ content: "These buttons aren't for you!", ephemeral: true });
      }

      if (btnInteraction.customId === 'previous') {
        page--;
      } else if (btnInteraction.customId === 'next') {
        page++;
      }

      if (page < 0) page = 0;
      if (page >= totalPages) page = totalPages - 1;

      row.components[0].setDisabled(page === 0);
      row.components[1].setDisabled(page === totalPages - 1);

      await btnInteraction.update({ embeds: [generateEmbed(page)], components: [row] });
    });

    collector.on('end', () => {
      row.components.forEach(button => button.setDisabled(true));
      sentMessage.edit({ components: [row] }).catch(() => {});
    });
  },
};