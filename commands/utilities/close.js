const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { getTicketMeta, logAndCloseTicket } = require('../../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this ticket')
    .addStringOption(o => o.setName('reason').setDescription('Optional reason for closing').setRequired(false)),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'staff')) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    const meta = await getTicketMeta(interaction.channel);
    if (!meta.category) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });

    const reason = interaction.options.getString('reason') || null;
    await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
    await logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason });
  }
};
