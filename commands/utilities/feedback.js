const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isVerified } = require('../../utils/permissions'); // your custom verified check

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Send feedback for a staff member or the server')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('What are you giving feedback about?')
        .setRequired(true)
        .addChoices(
          { name: 'Staff Member', value: 'staff' },
          { name: 'Server', value: 'server' }
        ))
    .addIntegerOption(option =>
      option
        .setName('rating')
        .setDescription('Rate from 1 to 5')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5))
    .addUserOption(option =>
      option
        .setName('staff')
        .setDescription('The staff member to rate (required if type is Staff Member)')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('comments')
        .setDescription('Additional comments or feedback')
        .setRequired(false)),

  async execute(interaction) {
    // Custom Verified permission check
    if (!isVerified(interaction.member)) {
      return interaction.reply({ content: '❌ You must be verified to use this command.', ephemeral: true });
    }

    const feedbackType = interaction.options.getString('type');
    const staffMember = interaction.options.getUser('staff');
    const rating = interaction.options.getInteger('rating');
    const comments = interaction.options.getString('comments') || 'No additional comments';

    if (feedbackType === 'staff' && !staffMember) {
      return interaction.reply({ content: 'Please specify a staff member to give feedback about.', ephemeral: true });
    }

    const channelId = process.env.FEEDBACK_CHANNEL_ID;
    const feedbackChannel = await interaction.client.channels.fetch(channelId).catch(() => null);

    if (!feedbackChannel) {
      return interaction.reply({ content: 'Feedback channel not found. Please contact an administrator.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('New Feedback Received')
      .setColor('#0099ff')
      .addFields(
        { name: 'Feedback Type', value: feedbackType === 'staff' ? 'Staff Member' : 'Server' },
        { name: 'Rating', value: rating.toString(), inline: true },
        { name: 'From', value: `${interaction.user.tag} (${interaction.user.id})` }
      )
      .setTimestamp();

    if (feedbackType === 'staff') {
      embed.addFields({ name: 'Staff Member', value: `${staffMember.tag} (${staffMember.id})` });
    }

    embed.addFields({ name: 'Comments', value: comments });

    await feedbackChannel.send({ embeds: [embed] });
    await interaction.reply({ content: 'Thank you for your feedback! 🙏', ephemeral: true });
  },
};
