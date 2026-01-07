// commands/shutdown.js
const { SlashCommandBuilder } = require('discord.js');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shuts down the bot (owner only)'),

  async execute(interaction, client) {
    const userId = interaction.user.id;

    // Only allow the specific user ID
    if (userId !== '698200964917624936') {
      return interaction.reply({
        content: '❌ You are not authorized to shut down the bot.',
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: '🛑 Shutting down the bot as requested...',
      ephemeral: true,
    });

    console.log(`Shutdown requested by ${interaction.user.tag} (${userId})`);

    // Gracefully destroy the client before exiting
    await client.destroy();

    // Optional: Exit the process
    process.exit(0);
  },
};