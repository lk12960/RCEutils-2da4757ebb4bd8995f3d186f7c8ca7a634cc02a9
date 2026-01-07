const {
  EmbedBuilder,
} = require('discord.js');
const infractionManager = require('../utils/infractionManager');
const { isManagement } = require('../utils/permissions');

const ITEMS_PER_PAGE = 10;

module.exports = {
  name: 'infraction-list',
  description: 'List infractions for a user with pagination.',
  usage: '>infraction-list @user',
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('❌ Please mention a valid user.');
    }

    const infractions = await infractionManager.getInfractionsByUserId(user.id);
    if (!infractions || infractions.length === 0) {
      return message.reply(`ℹ️ No infractions found for ${user.tag}.`);
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

    const embedMessage = await message.channel.send({ embeds: [generateEmbed(page)] });

    if (totalPages <= 1) return;

    await embedMessage.react('◀️');
    await embedMessage.react('▶️');

    const filter = (reaction, userReacted) =>
      ['◀️', '▶️'].includes(reaction.emoji.name) &&
      userReacted.id === message.author.id;

    const collector = embedMessage.createReactionCollector({ filter, time: 120000 });

    collector.on('collect', async (reaction, userReacted) => {
      try {
        await reaction.users.remove(userReacted.id);
      } catch {}

      if (reaction.emoji.name === '◀️' && page > 0) {
        page--;
      } else if (reaction.emoji.name === '▶️' && page < totalPages - 1) {
        page++;
      } else {
        return;
      }

      await embedMessage.edit({ embeds: [generateEmbed(page)] });
    });

    collector.on('end', async () => {
      try {
        await embedMessage.reactions.removeAll();
      } catch {}
    });
  },
};