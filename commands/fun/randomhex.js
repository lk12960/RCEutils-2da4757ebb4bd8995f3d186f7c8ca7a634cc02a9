const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomhex')
    .setDescription('Generates a random hex color code!'),

  async execute(interaction) {
    const randomHex = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

    const embed = new EmbedBuilder()
      .setTitle('🎨 Random Hex Color')
      .setDescription(`**Hex Code:** \`${randomHex}\``)
      .setColor(randomHex)
      .setImage(`https://singlecolorimage.com/get/${randomHex.replace('#', '')}/400x100`)
      .setFooter({ text: 'Use this color in your designs!' });

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
