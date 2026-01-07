const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a dice with a number of sides')
    .addIntegerOption(option =>
      option.setName('sides')
        .setDescription('Number of sides on the dice')
        .setMinValue(2)
        .setMaxValue(100)
        .setRequired(false)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    await interaction.reply(`🎲 You rolled a **${roll}** (1-${sides})`);
  },
};
