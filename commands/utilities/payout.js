const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { getEligiblePaymentsForDesigner, createPayoutRequest } = require('../../utils/payoutManager');

const APPROVAL_CHANNEL_ID = '1458206214528962751';
const LOG_CHANNEL_ID = '1458207384982786282';
const APPROVER_ROLE_ID = '1419399437997834301';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payout')
    .setDescription('Request payout for your completed orders (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });

    const designerId = interaction.user.id;
    const orders = await getEligiblePaymentsForDesigner(designerId);
    if (!orders.length) {
      return interaction.editReply({ content: 'ℹ️ No eligible confirmed orders found for payout.' });
    }
    const total = orders.reduce((s, o) => s + (Number(o.price)||0), 0);
    const payout = Math.floor(total * 0.6); // remove 40%

    const embed = new EmbedBuilder()
      .setTitle("Payout Request — Summary")
      .setColor(BRAND_COLOR_HEX)
      .addFields(
        { name: 'Designer', value: `${interaction.user}`, inline: true },
        { name: 'Orders', value: String(orders.length), inline: true },
        { name: 'Total (Robux)', value: String(total), inline: true },
        { name: 'Expected Payout (Robux)', value: String(payout), inline: true },
      )
      .setFooter({ text: `Requested at ${new Date().toUTCString()}` });

    await interaction.editReply({ embeds: [embed] });

    // Create payout record and link payments
    const { payoutId } = await createPayoutRequest(interaction.guild.id, interaction.user.id, designerId, orders, total, payout);

    // Send approval request to channel with approver role ping
    const approvalChannel = interaction.client.channels.cache.get(APPROVAL_CHANNEL_ID);
    if (approvalChannel && approvalChannel.isTextBased()) {
      const appEmbed = new EmbedBuilder()
        .setTitle('Designer Payout Request')
        .setColor(BRAND_COLOR_HEX)
        .setDescription(`${interaction.user} requests a payout.`)
        .addFields(
          { name: 'Designer', value: `<@${designerId}>`, inline: true },
          { name: 'Orders', value: String(orders.length), inline: true },
          { name: 'Total (Robux)', value: String(total), inline: true },
          { name: 'Expected Payout (Robux)', value: String(payout), inline: true },
        )
        .setFooter({ text: `Payout ID: ${payoutId} • ${new Date().toUTCString()}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`payout_approve:${payoutId}:${interaction.user.id}`).setStyle(ButtonStyle.Success).setLabel('Mark as Completed'),
        new ButtonBuilder().setCustomId(`payout_deny:${payoutId}:${interaction.user.id}`).setStyle(ButtonStyle.Danger).setLabel('Deny'),
      );

      await approvalChannel.send({ content: `<@&${APPROVER_ROLE_ID}>`, embeds: [appEmbed], components: [row] });
    }

    return;
  }
};
