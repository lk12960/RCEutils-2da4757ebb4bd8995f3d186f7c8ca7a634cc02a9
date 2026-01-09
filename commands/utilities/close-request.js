const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const { getTicketMeta, logAndCloseTicket } = require('../../utils/ticketUtils');
const { setChannelTimer, clearChannelTimer } = require('../../utils/ticketTimers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close-request')
    .setDescription('Request to close the current ticket with optional auto-close delay')
    .addStringOption(o => o.setName('delay').setDescription('Auto-close delay (e.g., 1m, 1h, 1d)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads),

  async execute(interaction) {
    // Allow staff or claimer to run; using ManageThreads as proxy permission
    const delayStr = interaction.options.getString('delay');
    const meta = await getTicketMeta(interaction.channel);
    if (!meta || !meta.openerId) {
      return interaction.reply({ content: 'This channel is not a ticket or missing metadata.', flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle('Close Request')
      .setDescription(`<@${meta.openerId}>, would you like to close this ticket?`)
      .setColor(0xFFA500);
    const nonce = Date.now().toString(36);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`close_req_confirm:${interaction.channel.id}:${nonce}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`close_req_keep:${interaction.channel.id}:${nonce}`).setLabel('Keep Open').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ content: `<@${meta.openerId}>`, embeds: [embed], components: [row] });

    if (delayStr) {
      const delayMs = ms(delayStr);
      if (delayMs && delayMs > 0) {
        const timeout = setTimeout(async () => {
          try {
            const fresh = await getTicketMeta(interaction.channel);
            // Attempt to close if not already deleted
            await logAndCloseTicket(interaction.channel, { category: fresh.category, openerId: fresh.openerId, claimedBy: fresh.claimedBy, closedBy: interaction.user.id, reason: 'Auto-closed after delay', ticketId: fresh.ticketId });
          } catch {}
          clearChannelTimer(interaction.channel.id);
        }, delayMs);
        setChannelTimer(interaction.channel.id, timeout);
      }
    }
  }
};
