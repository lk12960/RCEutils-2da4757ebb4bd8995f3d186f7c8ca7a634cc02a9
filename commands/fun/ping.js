const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and uptime'),

  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const uptimeMs = interaction.client.uptime;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    const embed = new EmbedBuilder()
      .setTitle('Pong! 🏓')
      .setColor(BRAND_COLOR_HEX)
      .setFooter({
        text: `Ping/Latency:\n\`${latency}ms\`\n\nUptime:\n\`${uptimeFormatted}\``,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
