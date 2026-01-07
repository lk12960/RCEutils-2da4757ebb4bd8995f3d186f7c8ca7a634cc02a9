const { SlashCommandBuilder } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { getTicketMeta } = require('../../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim this ticket (design team only)'),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'staff')) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    const meta = await getTicketMeta(interaction.channel);
    if (!meta.category) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    meta.claimedBy = interaction.user.id;
    try { await interaction.channel.setTopic(JSON.stringify(meta)); } catch {}
    return interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>.`, ephemeral: false });
  }
};
