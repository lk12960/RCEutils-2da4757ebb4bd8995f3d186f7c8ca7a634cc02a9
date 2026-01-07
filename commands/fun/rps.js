const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors against the bot.')
    .addStringOption(option =>
      option.setName('choice')
        .setDescription('Your choice')
        .setRequired(true)
        .addChoices(
          { name: 'Rock', value: 'rock' },
          { name: 'Paper', value: 'paper' },
          { name: 'Scissors', value: 'scissors' },
        )),
  async execute(interaction) {
    const userChoice = interaction.options.getString('choice');
    const choices = ['rock', 'paper', 'scissors'];

    // Add rare chance for "nuke"
    const random = Math.random();
    let botChoice;
    let result;

    if (random < 0.05) {
      botChoice = 'BOMB';
      result = '💥 I used **ATOMIC BOMB**. No survivors. 😈';
    } else {
      botChoice = choices[Math.floor(Math.random() * choices.length)];

      if (userChoice === botChoice) {
        result = "It's a draw!";
      } else if (
        (userChoice === 'rock' && botChoice === 'scissors') ||
        (userChoice === 'paper' && botChoice === 'rock') ||
        (userChoice === 'scissors' && botChoice === 'paper')
      ) {
        result = 'You win! 🎉';
      } else {
        result = 'You lose! 😢';
      }
    }

    await interaction.reply(`You chose **${userChoice}**, I chose **${botChoice}**. ${result}`);
  }
};