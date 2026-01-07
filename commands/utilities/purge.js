const { SlashCommandBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions'); // your custom permission check

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in the channel')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Custom permission check override
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: "❌ You don't have permission to manage messages.", ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `✅ Deleted ${deleted.size} messages.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Failed to delete messages. Messages older than 14 days cannot be deleted.', ephemeral: true });
    }
  },
};
