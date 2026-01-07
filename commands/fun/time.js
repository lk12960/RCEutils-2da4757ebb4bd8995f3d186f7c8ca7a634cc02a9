const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Get the current time for a specified timezone')
    .addStringOption(option =>
      option.setName('timezone')
        .setDescription('The timezone to get the time for (e.g., America/New_York)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const timezone = interaction.options.getString('timezone') || 'UTC';

    if (!moment.tz.zone(timezone)) {
      return interaction.reply({ content: 'Invalid timezone! Please provide a valid tz database timezone name.', ephemeral: true });
    }

    const now = moment().tz(timezone).format('dddd, MMMM Do YYYY, h:mm:ss A z');

    const embed = new EmbedBuilder()
      .setTitle(`Current Time in ${timezone}`)
      .setDescription(now)
      .setColor('#0099ff')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
