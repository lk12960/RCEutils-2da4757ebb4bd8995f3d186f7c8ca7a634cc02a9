const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Fixed reviews channel ID as requested
const REVIEWS_CHANNEL_ID = '1442316011566137425';

function buildStars(count) {
  const c = Math.max(1, Math.min(5, Number(count) || 0));
  return '⭐'.repeat(c);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription("Submit a review to the King's Customs reviews channel")
    .addIntegerOption(o =>
      o.setName('stars')
        .setDescription('Star rating (1-5)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addUserOption(o =>
      o.setName('designer')
        .setDescription('The designer you are reviewing')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason/details for your review')
        .setRequired(true)
        .setMaxLength(1000)
    ),

  async execute(interaction) {
    const stars = interaction.options.getInteger('stars', true);
    const designer = interaction.options.getUser('designer', true);
    const reason = interaction.options.getString('reason', true);

    const reviewsChannel = interaction.client.channels.cache.get(REVIEWS_CHANNEL_ID);
    if (!reviewsChannel || !reviewsChannel.isTextBased()) {
      return interaction.reply({ content: '❌ Reviews channel not found or not text-based. Please contact staff.', ephemeral: true });
    }

    const submittedBy = interaction.user;
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setTitle('New Review Submitted')
      // Exact color from the provided JSON (8388494)
      .setColor(8388494)
      .addFields(
        {
          name: 'Submitted By',
          value: `<@${submittedBy.id}> (${submittedBy.id})`,
          inline: true,
        },
        {
          name: 'Reviewed User',
          value: `<@${designer.id}> (${designer.id})`,
          inline: true,
        },
        {
          name: 'Stars',
          value: buildStars(stars),
          inline: true,
        },
        {
          name: 'Reason',
          value: reason,
          inline: true,
        },
      )
      .setFooter({ text: timestamp.toUTCString() });

    await reviewsChannel.send({ embeds: [embed] });
    try { await (require('../../utils/stats').track)('review', 1, interaction.guild?.id, { designer: designer.id, stars }); if (stars === 5) await (require('../../utils/stats').track)('review_5', 1, interaction.guild?.id, { designer: designer.id }); } catch {}

    return interaction.reply({ content: '✅ Your review has been submitted. Thank you!', ephemeral: true });
  }
};
