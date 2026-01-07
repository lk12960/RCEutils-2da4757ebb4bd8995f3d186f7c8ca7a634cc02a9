const { SlashCommandBuilder } = require('discord.js');
const figlet = require('figlet');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ascii')
    .setDescription('Convert text to ASCII art')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Text to convert')
        .setRequired(true)),
  async execute(interaction) {
    const text = interaction.options.getString('text');

    // Generate ASCII art
    figlet(text, (err, data) => {
      if (err) {
        return interaction.reply('Something went wrong with ASCII conversion.');
      }
      // Discord message limit is 2000 chars; truncate if needed
      if (data.length > 1990) {
        data = data.slice(0, 1990) + '\n...';
      }
      interaction.reply('```' + data + '```');
    });
  },
};
