const { SlashCommandBuilder } = require('discord.js');

const responses = [
  "It is certain.",
  "Without a doubt.",
  "You may rely on it.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Don't count on it.",
  "My reply is no.",
  "Very doubtful.",
];

const jamesYesResponses = [
  "Absolutely yes!",
  "Yes, without a doubt!",
  "You can rely on it, yes.",
  "Definitely yes!",
  "Yes, it's certain.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question')
        .setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const userId = interaction.user.id;

    let response;

      response = responses[Math.floor(Math.random() * responses.length)];

    await interaction.reply(`🎱 You asked: "${question}"\n**Answer:** ${response}`);
  },
};
