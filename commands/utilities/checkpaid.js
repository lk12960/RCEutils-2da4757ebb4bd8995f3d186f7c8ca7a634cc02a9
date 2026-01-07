const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { getPayment, markConfirmed } = require('../../utils/paymentManager');
const { checkGamePassOwnership } = require('../../utils/robloxOwnership');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkpaid')
    .setDescription('Check whether a Roblox user has purchased the product for an order ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('orderid').setDescription('Order ID to check').setRequired(true))
    .addStringOption(o => o.setName('robloxuser').setDescription('Roblox username').setRequired(true)),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    }

    const orderId = interaction.options.getString('orderid', true).trim();
    const robloxUser = interaction.options.getString('robloxuser', true).trim();

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply(); // public

    try {
      const payment = await getPayment(orderId);
      if (!payment) {
        return interaction.editReply({ content: '❌ Order ID not found.' });
      }

      const passId = payment.pass_id;
      const reason = payment.reason;
      const price = payment.price;

      // Check ownership via Inventories Game Pass Owners
      console.log(`[checkpaid] Checking ownership for ${robloxUser} on pass ${passId}...`);
      const owns = await checkGamePassOwnership(passId, robloxUser);
      console.log(`[checkpaid] Ownership result: ${owns}`);

      if (owns) {
        const embed = new EmbedBuilder()
          .setTitle(`King's Customs — Payment Confirmed for ${robloxUser}`)
          .setDescription(`• Reason: ${reason}\n• Price: ${price} Robux`)
          .setFooter({ text: `Order ID: ${orderId}` })
          .setColor(BRAND_COLOR_HEX);
        // Mark as confirmed (idempotent)
        await markConfirmed(orderId).catch(() => {});
        // Build designer-only Log Order button if a payee_id was stored
        const components = [];
        if (payment.payee_id) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`log_order:${orderId}:${payment.payee_id}`).setStyle(ButtonStyle.Success).setLabel('Log Order')
          );
          components.push(row);
        }
        return interaction.editReply({ embeds: [embed], components });
      }

      return interaction.editReply({ content: `❌ ${robloxUser} has not been found as an owner for game pass ${passId}.` });
    } catch (e) {
      console.error('checkpaid error:', e);
      return interaction.editReply({ content: '❌ Error checking payment status. Please try again later.' });
    }
  }
};
