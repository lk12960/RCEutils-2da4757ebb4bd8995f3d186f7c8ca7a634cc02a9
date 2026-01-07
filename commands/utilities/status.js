const { SlashCommandBuilder } = require('discord.js');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Set the bot status to DND and activity to Watching Royal Designs'),

  async execute(interaction, client) {
    // Only allow user ID 698200964917624936
    if (interaction.user.id !== '698200964917624936') {
      // Use flags for ephemeral to avoid deprecation warning
      return interaction.reply({ content: '❌ You are not authorized to use this command.', flags: 64 });
    }

    let acknowledged = false;
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
        acknowledged = true;
      }

      await client.user.setPresence({
        status: 'dnd',
        activities: [
          {
            name: "King's Customs",
            type: 3, // 3 = Watching
          },
        ],
      });

      if (acknowledged || interaction.deferred) {
        await interaction.editReply({ content: "✅ Status updated to Do Not Disturb and Watching King's Customs." });
      } else if (interaction.replied) {
        await interaction.followUp({ content: "✅ Status updated to Do Not Disturb and Watching King's Customs.", flags: 64 });
      } else {
        await interaction.reply({ content: "✅ Status updated to Do Not Disturb and Watching King's Customs.", flags: 64 });
      }
    } catch (error) {
      console.error('Error setting bot status:', error);
      try {
        if (acknowledged || interaction.deferred) return interaction.editReply({ content: '⚠️ Failed to update status.' });
        if (interaction.replied) return interaction.followUp({ content: '⚠️ Failed to update status.', flags: 64 });
        return interaction.reply({ content: '⚠️ Failed to update status.', flags: 64 });
      } catch {}
    }
  },
};