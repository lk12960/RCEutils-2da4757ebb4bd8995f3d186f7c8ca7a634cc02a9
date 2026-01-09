const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getPayment, updateOrder } = require('../../utils/paymentManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-edit')
    .setDescription('Edit an order (Management only)')
    .addStringOption(o => o.setName('order-id').setDescription('Order ID to edit').setRequired(true)),

  async execute(interaction) {
    // Check if user is management (ManageGuild permission or Owner)
    const isManagement = interaction.member.permissions.has('ManageGuild') || 
                         interaction.user.id === interaction.guild.ownerId;
    
    if (!isManagement) {
      return interaction.reply({ content: '❌ This command is only available to management.', ephemeral: true });
    }

    const orderId = interaction.options.getString('order-id');
    
    try {
      const order = await getPayment(orderId);
      
      if (!order) {
        return interaction.reply({ content: '❌ Order not found.', ephemeral: true });
      }
      
      // Build edit panel with buttons
      const embed = new EmbedBuilder()
        .setTitle(`${BRAND_NAME} — Edit Order`)
        .setColor(BRAND_COLOR_HEX)
        .addFields(
          { name: 'Order ID', value: orderId, inline: true },
          { name: 'Status', value: order.status, inline: true },
          { name: 'Voided', value: order.voided ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Designer', value: order.payee_id ? `<@${order.payee_id}>` : 'Not assigned', inline: true },
          { name: 'Price', value: `${order.price} Robux`, inline: true },
          { name: 'Roblox User', value: order.roblox_username, inline: true },
          { name: 'Reason', value: order.reason || 'N/A' }
        )
        .setFooter({ text: BRAND_NAME });
      
      const voidButton = new ButtonBuilder()
        .setCustomId(`order_edit_void:${orderId}`)
        .setLabel(order.voided ? 'Unvoid Order' : 'Void Order')
        .setStyle(order.voided ? ButtonStyle.Success : ButtonStyle.Danger);
      
      const designerButton = new ButtonBuilder()
        .setCustomId(`order_edit_designer:${orderId}`)
        .setLabel('Change Designer')
        .setStyle(ButtonStyle.Primary);
      
      const reasonButton = new ButtonBuilder()
        .setCustomId(`order_edit_reason:${orderId}`)
        .setLabel('Edit Reason')
        .setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(voidButton, designerButton, reasonButton);
      
      const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });
      
      // Set up button collector
      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.message.id === reply.id,
        time: 300000 // 5 minutes
      });
      
      collector.on('collect', async i => {
        if (i.customId.startsWith('order_edit_void:')) {
          await i.deferUpdate();
          
          const newVoidedState = !order.voided;
          await updateOrder(orderId, { voided: newVoidedState });
          order.voided = newVoidedState;
          
          // Send DM to designer
          if (order.payee_id) {
            try {
              const designer = await interaction.client.users.fetch(order.payee_id);
              const dmEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — Order ${newVoidedState ? 'Voided' : 'Unvoided'}`)
                .setDescription(`An order assigned to you has been ${newVoidedState ? 'voided' : 'unvoided'} by management.`)
                .setColor(newVoidedState ? 0xFF0000 : 0x00FF00)
                .addFields(
                  { name: 'Order ID', value: orderId, inline: true },
                  { name: 'Status', value: newVoidedState ? 'Voided' : 'Active', inline: true },
                  { name: 'Price', value: `${order.price} Robux`, inline: true },
                  { name: 'Reason', value: order.reason || 'N/A' }
                )
                .setFooter({ text: `If you need more information, please open an HR support ticket.` });
              
              await designer.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (e) {
              console.error('Failed to send DM to designer:', e);
            }
          }
          
          // Update the embed
          const updatedEmbed = EmbedBuilder.from(embed)
            .setFields(
              { name: 'Order ID', value: orderId, inline: true },
              { name: 'Status', value: order.status, inline: true },
              { name: 'Voided', value: order.voided ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Designer', value: order.payee_id ? `<@${order.payee_id}>` : 'Not assigned', inline: true },
              { name: 'Price', value: `${order.price} Robux`, inline: true },
              { name: 'Roblox User', value: order.roblox_username, inline: true },
              { name: 'Reason', value: order.reason || 'N/A' }
            );
          
          const updatedVoidButton = new ButtonBuilder()
            .setCustomId(`order_edit_void:${orderId}`)
            .setLabel(order.voided ? 'Unvoid Order' : 'Void Order')
            .setStyle(order.voided ? ButtonStyle.Success : ButtonStyle.Danger);
          
          const updatedRow = new ActionRowBuilder().addComponents(updatedVoidButton, designerButton, reasonButton);
          
          await i.editReply({ embeds: [updatedEmbed], components: [updatedRow] });
          
        } else if (i.customId.startsWith('order_edit_designer:')) {
          const modal = new ModalBuilder()
            .setCustomId(`order_edit_designer_modal:${orderId}`)
            .setTitle('Change Designer');
          
          const input = new TextInputBuilder()
            .setCustomId('designer_id')
            .setLabel('Designer User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter Discord User ID')
            .setValue(order.payee_id || '')
            .setRequired(true);
          
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await i.showModal(modal);
          
        } else if (i.customId.startsWith('order_edit_reason:')) {
          const modal = new ModalBuilder()
            .setCustomId(`order_edit_reason_modal:${orderId}`)
            .setTitle('Edit Reason');
          
          const input = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Order Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(order.reason || '')
            .setRequired(true);
          
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await i.showModal(modal);
        }
      });
      
      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
      
    } catch (error) {
      console.error('Error editing order:', error);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: '❌ Failed to load order. Please try again.', ephemeral: true });
      } else {
        return interaction.editReply({ content: '❌ Failed to load order. Please try again.' });
      }
    }
  }
};
