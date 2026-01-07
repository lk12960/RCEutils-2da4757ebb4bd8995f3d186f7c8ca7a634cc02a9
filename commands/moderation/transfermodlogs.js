const { SlashCommandBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { transferCases } = require('../../utils/caseManager');
const { transferInfractions } = require('../../utils/infractionManager');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfermodlogs')
    .setDescription('Transfers mod cases from one user to another')
    .addUserOption(option =>
      option.setName('from')
        .setDescription('User to transfer cases from')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('to')
        .setDescription('User to transfer cases to')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const fromUser = interaction.options.getUser('from');
    const toUser = interaction.options.getUser('to');

    if (fromUser.id === toUser.id) {
      return interaction.reply({
        content: '❌ You cannot transfer cases to the same user.',
        ephemeral: true
      });
    }

    try {
      const casesMoved = await transferCases(fromUser.id, toUser.id);
      const infractionsMoved = await transferInfractions(fromUser.id, toUser.id);
      return interaction.reply({
        content: `✅ Transferred ${casesMoved} case(s) and ${infractionsMoved} infraction(s) from <@${fromUser.id}> to <@${toUser.id}>.`,
        allowedMentions: { users: [] }
      });
    } catch (err) {
      console.error('Error transferring logs:', err);
      return interaction.reply({ content: '❌ An error occurred while transferring logs.', ephemeral: true });
    }
  }
};