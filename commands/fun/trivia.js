const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const axios = require('axios');
const he = require('he'); // for HTML entity decoding

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Get a random trivia question'),

  async execute(interaction) {
    try {
      const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
      const questionData = response.data.results[0];

      const question = he.decode(questionData.question);
      const correctAnswer = he.decode(questionData.correct_answer);
      const incorrectAnswers = questionData.incorrect_answers.map(ans => he.decode(ans));

      // Shuffle answers
      const answers = [correctAnswer, ...incorrectAnswers]
        .map(answer => ({ answer, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(obj => obj.answer);

      const correctIndex = answers.indexOf(correctAnswer);

      // Create buttons for answers
      const buttons = new ActionRowBuilder();
      answers.forEach((ans, i) => {
        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`answer_${i}`)
            .setLabel(ans)
            .setStyle(ButtonStyle.Primary)
        );
      });

      // Send embed with question
      const embed = new EmbedBuilder()
        .setTitle('Trivia Time!')
        .setDescription(question)
        .setColor(0x00AE86)
        .setFooter({ text: 'You have 30 seconds to answer!' });

      await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });

      // Create a collector to listen for button clicks from the user who invoked the command
      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000, // 30 seconds
        filter: i => i.user.id === interaction.user.id,
        max: 1,
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        const selected = parseInt(i.customId.split('_')[1]);

        let resultEmbed;
        if (selected === correctIndex) {
          resultEmbed = new EmbedBuilder()
            .setTitle('Correct! 🎉')
            .setDescription(`You chose the right answer: **${correctAnswer}**`)
            .setColor(0x57F287);
        } else {
          resultEmbed = new EmbedBuilder()
            .setTitle('Wrong Answer 😢')
            .setDescription(`You chose **${answers[selected]}** but the correct answer was **${correctAnswer}**.`)
            .setColor(0xED4245);
        }

        // Disable buttons after answering
        buttons.components.forEach(btn => btn.setDisabled(true));
        await interaction.editReply({ embeds: [resultEmbed], components: [buttons] });
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          // Disable buttons if time runs out
          buttons.components.forEach(btn => btn.setDisabled(true));
          interaction.editReply({ content: 'Time is up!', components: [buttons] }).catch(() => {});
        }
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch trivia question.', ephemeral: true });
    }
  }
};
