const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { getPayment } = require('../../utils/paymentManager');
const { gamePassUrl } = require('../../utils/robloxOpenCloud');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-status')
    .setDescription('Check the status of an order by ID')
    .addStringOption(o => o.setName('orderid').setDescription('Order ID from /payprompt').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const orderId = interaction.options.getString('orderid', true).trim();
    await interaction.deferReply({ ephemeral: true });

    const payment = await getPayment(orderId).catch(() => null);
    if (!payment) {
      return interaction.editReply({ content: '❌ Order not found.' });
    }

    const embed = new EmbedBuilder()
      .setTitle("King's Customs — Order Status")
      .setColor(BRAND_COLOR_HEX)
      .addFields(
        { name: 'Order ID', value: orderId, inline: false },
        { name: 'Roblox Username', value: payment.roblox_username, inline: true },
        { name: 'Price (Robux)', value: String(payment.price), inline: true },
        { name: 'Reason', value: payment.reason || 'N/A', inline: false },
        { name: 'Status', value: payment.status, inline: true },
        { name: 'Pass ID', value: String(payment.pass_id), inline: true },
      )
      .setFooter({ text: [payment.created_at ? `Created: ${payment.created_at}` : null, payment.confirmed_at ? `Confirmed: ${payment.confirmed_at}` : null, payment.logged_at ? `Logged: ${payment.logged_at}` : null].filter(Boolean).join(' | ') });

    const url = gamePassUrl(payment.pass_id);
    embed.addFields({ name: 'Game Pass Link', value: url });

    return interaction.editReply({ embeds: [embed] });
  }
};
