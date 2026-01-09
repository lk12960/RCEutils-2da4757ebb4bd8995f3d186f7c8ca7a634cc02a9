const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrdersByDesigner } = require('../../utils/paymentManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-orders')
    .setDescription('List orders for a designer with pagination')
    .addUserOption(o => o.setName('designer').setDescription('Designer to list orders for').setRequired(false))
    .addStringOption(o => o.setName('since-date').setDescription('Only show orders since this date (YYYY-MM-DD)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Get designer - if not provided, use the command user
    const designer = interaction.options.getUser('designer') || interaction.user;
    const sinceDate = interaction.options.getString('since-date');
    
    // Validate date format if provided
    let sinceISO = null;
    if (sinceDate) {
      const parsed = new Date(sinceDate);
      if (isNaN(parsed.getTime())) {
        return interaction.editReply({ content: '❌ Invalid date format. Use YYYY-MM-DD (e.g., 2024-01-01).' });
      }
      sinceISO = parsed.toISOString();
    }
    
    try {
      const orders = await getOrdersByDesigner(designer.id, sinceISO);
      
      if (orders.length === 0) {
        const msg = sinceDate 
          ? `No orders found for ${designer.tag} since ${sinceDate}.`
          : `No orders found for ${designer.tag}.`;
        return interaction.editReply({ content: msg });
      }
      
      // Pagination setup
      const ITEMS_PER_PAGE = 10;
      const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
      let currentPage = 0;
      
      const generateEmbed = (page) => {
        const start = page * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageOrders = orders.slice(start, end);
        
        const embed = new EmbedBuilder()
          .setTitle(`${BRAND_NAME} — Orders for ${designer.tag}`)
          .setColor(BRAND_COLOR_HEX)
          .setDescription(`Showing ${start + 1}-${Math.min(end, orders.length)} of ${orders.length} orders`)
          .setFooter({ text: `${BRAND_NAME} • Page ${page + 1}/${totalPages}` });
        
        if (sinceDate) {
          embed.addFields({ name: 'Filter', value: `Since: ${sinceDate}` });
        }
        
        for (const order of pageOrders) {
          const fields = [];
          fields.push(`**Roblox User:** ${order.roblox_username}`);
          fields.push(`**Price:** ${order.price} Robux`);
          fields.push(`**Status:** ${order.status}`);
          if (order.ticket_id) {
            fields.push(`**Ticket ID:** #${order.ticket_id}`);
          }
          fields.push(`**Reason:** ${order.reason}`);
          if (order.confirmed_at) {
            const date = new Date(order.confirmed_at);
            fields.push(`**Confirmed:** ${date.toLocaleDateString()}`);
          }
          
          embed.addFields({
            name: `Order #${order.order_num || 'N/A'} (${order.order_id.slice(0, 8)}...)`,
            value: fields.join('\n'),
            inline: false
          });
        }
        
        return embed;
      };
      
      const generateButtons = (page) => {
        const row = new ActionRowBuilder();
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`list_orders_prev:${designer.id}:${page}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0)
        );
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`list_orders_next:${designer.id}:${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
        );
        
        return row;
      };
      
      const message = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: totalPages > 1 ? [generateButtons(currentPage)] : []
      });
      
      // Set up button collector if there are multiple pages
      if (totalPages > 1) {
        const collector = message.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id,
          time: 300000 // 5 minutes
        });
        
        collector.on('collect', async i => {
          if (i.customId.startsWith('list_orders_prev:')) {
            currentPage = Math.max(0, currentPage - 1);
          } else if (i.customId.startsWith('list_orders_next:')) {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
          }
          
          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
          });
        });
        
        collector.on('end', () => {
          interaction.editReply({ components: [] }).catch(() => {});
        });
      }
      
    } catch (error) {
      console.error('Error listing orders:', error);
      return interaction.editReply({ content: '❌ Failed to retrieve orders. Please try again.' });
    }
  }
};
