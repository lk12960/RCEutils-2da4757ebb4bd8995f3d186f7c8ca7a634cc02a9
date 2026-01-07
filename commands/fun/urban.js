const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('urban')
    .setDescription('Get the Urban Dictionary definition of a word')
    .addStringOption(option =>
      option.setName('word')
        .setDescription('The word to look up')
        .setRequired(true)
    ),

  async execute(interaction) {
    const word = interaction.options.getString('word');

    try {
      const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
      if (!response.ok) throw new Error('Failed to fetch Urban Dictionary data.');

      const data = await response.json();
      if (!data.list.length) {
        return interaction.reply({ content: `No definitions found for **${word}**.`, ephemeral: true });
      }

      const definition = data.list[0].definition.length > 1024
        ? data.list[0].definition.slice(0, 1021) + '...'
        : data.list[0].definition;

      const example = data.list[0].example.length > 1024
        ? data.list[0].example.slice(0, 1021) + '...'
        : data.list[0].example;

      const embed = new EmbedBuilder()
        .setTitle(`Urban Dictionary: ${word}`)
        .setURL(data.list[0].permalink)
        .setColor('#1D2439')
        .addFields(
          { name: 'Definition', value: definition },
          { name: 'Example', value: example || 'No example provided.' },
          { name: '👍', value: data.list[0].thumbs_up.toString(), inline: true },
          { name: '👎', value: data.list[0].thumbs_down.toString(), inline: true },
        )
        .setFooter({ text: 'Powered by Urban Dictionary' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Error fetching definition. Please try again later.', ephemeral: true });
    }
  },
};
