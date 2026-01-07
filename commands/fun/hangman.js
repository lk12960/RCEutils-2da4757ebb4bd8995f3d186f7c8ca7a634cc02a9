const { 
  SlashCommandBuilder, 
  EmbedBuilder 
} = require('discord.js');

const WORDS = [
  'discord', 'hangman', 'javascript', 'nodejs', 'bot', 'programming', 'openai', 'chatgpt', 'interaction'
];

const MAX_WRONG = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function displayWord(word, guessedLetters) {
  return word
    .toUpperCase()
    .split('')
    .map(l => (guessedLetters.includes(l) ? l : '⬜'))
    .join(' ');
}

function hangmanStage(wrongGuesses) {
  const stages = [
    '',
    'Head',
    'Head, Body',
    'Head, Body, Left Arm',
    'Head, Body, Left Arm, Right Arm',
    'Head, Body, Left Arm, Right Arm, Left Leg',
    'Head, Body, Left Arm, Right Arm, Left Leg, Right Leg (FULL HANGMAN)'
  ];
  return stages[wrongGuesses];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hangman')
    .setDescription('Play a game of Hangman'),

  async execute(interaction) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
    let guessedLetters = [];
    let wrongGuesses = 0;

    const embed = new EmbedBuilder()
      .setTitle('Hangman Game')
      .setDescription(`Word: ${displayWord(word, guessedLetters)}\n\nWrong guesses: ${wrongGuesses}/${MAX_WRONG}\n${hangmanStage(wrongGuesses)}`)
      .setColor('Orange')
      .setFooter({ text: 'Guess the word by typing a letter in chat!' });

    await interaction.reply({ embeds: [embed] });

    const filter = m => 
      m.author.id === interaction.user.id &&       // only accept guesses from the user who started the game
      /^[a-zA-Z]$/.test(m.content);                 // only single letters

    const collector = interaction.channel.createMessageCollector({ filter, time: 60000 * 5 });

    collector.on('collect', async m => {
      const letter = m.content.toUpperCase();

      if (guessedLetters.includes(letter)) {
        try {
          await m.reply({ content: "You already guessed that letter!", ephemeral: true });
        } catch {
          // ignore errors from ephemeral replies outside interactions
        }
        return;
      }

      guessedLetters.push(letter);

      if (!word.includes(letter)) {
        wrongGuesses++;
      }

      const wordDisplay = displayWord(word, guessedLetters);

      // Check win
      if (!wordDisplay.includes('⬜')) {
        embed.setDescription(`🎉 You guessed the word: **${word}**! You win!`);
        embed.setColor('Green');
        await interaction.editReply({ embeds: [embed] });
        collector.stop('win');
        return;
      }

      // Check lose
      if (wrongGuesses >= MAX_WRONG) {
        embed.setDescription(`💀 You lost! The word was **${word}**.`);
        embed.setColor('Red');
        await interaction.editReply({ embeds: [embed] });
        collector.stop('lose');
        return;
      }

      // Continue game
      embed.setDescription(`Word: ${wordDisplay}\n\nWrong guesses: ${wrongGuesses}/${MAX_WRONG}\n${hangmanStage(wrongGuesses)}`);
      await interaction.editReply({ embeds: [embed] });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'win' && reason !== 'lose') {
        embed.setDescription(`Game ended due to timeout. The word was **${word}**.`);
        embed.setColor('Grey');
        interaction.editReply({ embeds: [embed] });
      }
    });
  }
};
