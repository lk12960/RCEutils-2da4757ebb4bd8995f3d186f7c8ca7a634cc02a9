const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { requireTier } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { ensureGamePassSlot, gamePassUrl } = require('../../utils/robloxOpenCloud');
const { createPayment } = require('../../utils/paymentManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payprompt')
    .setDescription('Create a Roblox Game Pass payment request for a payer (auto-manages pass slots)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('roblox_username').setDescription('Roblox username of the payer').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Price in Robux (integer)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason / title for the payment').setRequired(true)),

  async execute(interaction) {
    // Restrict to management tier (owner bypass allowed by our permissions helper)
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }

    const robloxUsername = interaction.options.getString('roblox_username', true).trim();
    const toUser = interaction.options.getUser('to') || interaction.user;
    const price = interaction.options.getInteger('price', true);
    const reason = interaction.options.getString('reason', true).trim();

    if (price <= 0) {
      return interaction.reply({ content: '❌ Price must be a positive integer Robux amount.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(); // public in-channel
    }

    try {
      // Create or reuse a Game Pass slot and configure it for this payment
      const payeeDiscord = toUser;
      const { passId } = await ensureGamePassSlot(reason, price, `Payment to ${payeeDiscord.username} for ${reason}`);
      if (!passId) throw new Error('Missing passId from Open Cloud response');

      // Generate order id & save mapping (PENDING)
      // Allocate next sequential order number and persist
      const orderId = uuidv4();
      const { orderNum } = await createPayment(orderId, passId, robloxUsername, price, reason);

      const embed = new EmbedBuilder()
        .setTitle("King's Customs — Payment Request")
        .setColor(BRAND_COLOR_HEX)
        .setDescription([
          `Dear ${robloxUsername},`,
          '',
          `You have a payment request for ${price} Robux regarding: ${reason}.`,
          `This payment is to compensate: ${payeeDiscord} (King's Customs).`,
          '',
          `[Complete your payment on Roblox](${gamePassUrl(passId)}).`,
        ].join('\n'))
        .setFooter({ text: `Order #${orderNum}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('payprompt error:', err);
      await interaction.editReply({ content: `❌ Failed to create payment: ${err.message || err}` });
    }
  }
};
