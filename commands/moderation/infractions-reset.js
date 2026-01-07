const { SlashCommandBuilder } = require('discord.js');
const { wipeAllInfractions } = require('../../utils/infractionManager'); // you’ll create this
const OWNER_ID = '698200964917624936';

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('wipe-infractions')
    .setDescription('Wipes ALL infractions from the database (irreversible)'),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
    }

    try {
      const wipedCount = await wipeAllInfractions();
      return interaction.reply(`✅ Wiped **${wipedCount}** infractions from the database.`);
    } catch (error) {
      console.error('Failed to wipe infractions:', error);
      return interaction.reply({ content: '❌ Failed to wipe infractions. Check the logs.', ephemeral: true });
    }
  },
};
