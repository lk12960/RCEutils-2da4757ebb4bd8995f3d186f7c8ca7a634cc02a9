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
        { name: 'Status', value: payment.status, inline: true }
      );

    // Add category if available
    if (payment.category) {
      embed.addFields({ name: 'Category', value: payment.category, inline: true });
    }

    // Add item if available
    if (payment.item) {
      embed.addFields({ name: 'Item', value: payment.item, inline: true });
    }

    // Add reason/details
    embed.addFields({ name: 'Reason/Details', value: payment.reason || 'N/A', inline: false });

    // Add pass ID and link
    embed.addFields({ name: 'Pass ID', value: String(payment.pass_id), inline: true });
    const url = gamePassUrl(payment.pass_id);
    embed.addFields({ name: 'Game Pass Link', value: url, inline: false });

    // Add designer if assigned
    if (payment.payee_id) {
      embed.addFields({ name: 'Assigned Designer', value: `<@${payment.payee_id}>`, inline: true });
    }

    // Add timestamps footer
    const timestamps = [
      payment.created_at ? `Created: ${payment.created_at}` : null,
      payment.confirmed_at ? `Confirmed: ${payment.confirmed_at}` : null,
      payment.logged_at ? `Logged: ${payment.logged_at}` : null
    ].filter(Boolean).join(' | ');

    if (timestamps) {
      embed.setFooter({ text: timestamps });
    }

    return interaction.editReply({ embeds: [embed] });
  }
};
