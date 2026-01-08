const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { requireTier } = require('../../utils/permissions');
const { getPayment, markConfirmed } = require('../../utils/paymentManager');
const { checkGamePassOwnership } = require('../../utils/robloxOwnership');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkpaid')
    .setDescription('Check whether a Roblox user has purchased the product for an order ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('orderid')
        .setDescription('Order ID to check')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('robloxuser')
        .setDescription('Roblox username')
        .setRequired(true)
    ),

  async execute(interaction) {
    const isOwner =
      interaction.guild &&
      interaction.user.id === interaction.guild.ownerId;

    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const orderId = interaction.options.getString('orderid', true).trim();
    const robloxUser = interaction.options.getString('robloxuser', true).trim();

    // Defer immediately before any async operations
    await interaction.deferReply();

    try {
      const payment = await getPayment(orderId);
      if (!payment) {
        return interaction.editReply({
          content: '❌ Order ID not found.'
        });
      }

      const passId = payment.pass_id;
      const reason = payment.reason;
      const price = payment.price;

      if (!passId) {
        console.error(`[checkpaid] Missing pass_id for order ${orderId}`);
        return interaction.editReply({
          content: '❌ This order has no associated Game Pass.'
        });
      }

      console.log(
        `[checkpaid] Checking ownership: user=${robloxUser}, pass=${passId}`
      );

      const owns = await checkGamePassOwnership(passId, robloxUser);

      console.log(`[checkpaid] Ownership result: ${owns}`);

      if (!owns) {
        return interaction.editReply({
          content: `❌ ${robloxUser} has **not** purchased Game Pass ${passId}.`
        });
      }

      // Confirm payment
      console.log(`[checkpaid] Marking order ${orderId} as CONFIRMED...`);
      const markResult = await markConfirmed(orderId).catch((err) => {
        console.error(`[checkpaid] Failed to mark confirmed:`, err);
        return false;
      });
      console.log(`[checkpaid] Mark confirmed result: ${markResult}`);
      
      const embed = new EmbedBuilder()
        .setTitle(`King's Customs — Payment Confirmed`)
        .setDescription(
          `**Roblox User:** ${robloxUser}\n` +
          `**Reason:** ${reason}\n` +
          `**Price:** ${price} Robux`
        )
        .setFooter({ text: `Order ID: ${orderId}` })
        .setColor(BRAND_COLOR_HEX);

      const components = [];

      // Create Log Order button - use payee_id if available, otherwise use roblox_username
      const buttonIdentifier = payment.payee_id || payment.roblox_username || robloxUser;
      console.log(`[checkpaid] Creating Log Order button with identifier: ${buttonIdentifier}`);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`log_order:${orderId}:${buttonIdentifier}`)
          .setLabel('Log Order')
          .setStyle(ButtonStyle.Success)
      );
      components.push(row);
      console.log(`[checkpaid] Button added - Components array length: ${components.length}`);

      return interaction.editReply({
        embeds: [embed],
        components
      });

    } catch (err) {
      console.error('[checkpaid] Error:', err);
      return interaction.editReply({
        content: '❌ Error checking payment status. Please try again later.'
      });
    }
  }
};
