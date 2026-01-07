const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTicketMeta } = require('../../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfer this ticket to another support rep (auto-claim)')
    .addUserOption(o => o.setName('to').setDescription('User to transfer to').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const meta = await getTicketMeta(interaction.channel);
    if (!meta || !meta.openerId) return interaction.reply({ content: 'Not a ticket channel.', ephemeral: true });
    const currentClaimer = meta.claimedBy;
    if (currentClaimer && currentClaimer !== interaction.user.id) {
      return interaction.reply({ content: 'Only the current claimer can transfer this ticket.', ephemeral: true });
    }
    const target = interaction.options.getUser('to', true);
    meta.claimedBy = target.id;
    try {
      await interaction.channel.setTopic(JSON.stringify(meta));
      return interaction.reply({ content: `✅ Transferred to <@${target.id}>. They now own this ticket.`, ephemeral: false });
    } catch (e) {
      console.error('transfer error:', e);
      return interaction.reply({ content: '❌ Failed to transfer.', ephemeral: true });
    }
  }
};
