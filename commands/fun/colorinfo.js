// commands/fun/colorinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('colorinfo')
    .setDescription('Get info about a color by hex code.')
    .addStringOption(opt =>
      opt.setName('hex')
        .setDescription('Hex color (e.g., #ff5733)')
        .setRequired(true)),
  async execute(interaction) {
    const hex = interaction.options.getString('hex').replace('#', '');
    const color = `#${hex}`;

    if (!/^([A-Fa-f0-9]{6})$/.test(hex)) {
      return interaction.reply({ content: '❌ Invalid hex code!', ephemeral: true });
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const embed = new EmbedBuilder()
      .setTitle(`🎨 Color Info: #${hex.toUpperCase()}`)
      .setColor(color)
      .addFields(
        { name: 'Hex', value: `\`#${hex.toUpperCase()}\``, inline: true },
        { name: 'RGB', value: `\`${r}, ${g}, ${b}\``, inline: true }
      )
      .setImage(`https://singlecolorimage.com/get/${hex}/600x100`);

    await interaction.reply({ embeds: [embed] });
  }
};