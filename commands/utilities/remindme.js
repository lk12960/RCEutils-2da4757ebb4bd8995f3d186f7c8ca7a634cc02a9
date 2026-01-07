const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a reminder and get pinged when the time is up')
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('Minutes until reminder')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440)) // max 24 hours
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Reminder message')
        .setRequired(true)),

  async execute(interaction) {
    const minutes = interaction.options.getInteger('minutes');
    const message = interaction.options.getString('message');

    await interaction.reply({ content: `⏰ Reminder set for ${minutes} minute(s). I will ping you then!`, ephemeral: true });

    setTimeout(() => {
      interaction.channel.send(`${interaction.user}, ⏰ Reminder: ${message}`);
    }, minutes * 60 * 1000);
  },
};
