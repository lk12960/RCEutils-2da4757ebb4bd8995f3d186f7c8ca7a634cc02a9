const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { setSetting } = require('../../utils/settingsManager');
const { isManagement } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orders-setup')
    .setDescription('Owner/Management: Configure the Orders category and Orders log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o =>
      o.setName('orders_category')
        .setDescription('Existing category to contain order tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addChannelOption(o =>
      o.setName('orders_log_channel')
        .setDescription('Existing text channel for confirmed order logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption(o =>
      o.setName('tickets_log_channel')
        .setDescription('Existing text channel for ticket transcripts (defaults to 1411101330558291978)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('duplicate_ticket_to_orders_log')
        .setDescription('Also post tickets to Orders Log (in addition to Tickets Log)')
        .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('autocreate')
        .setDescription('If not provided, automatically create missing category/channel')
        .setRequired(false)
    ),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    const providedCategory = interaction.options.getChannel('orders_category');
    const providedOrdersLog = interaction.options.getChannel('orders_log_channel');
    const providedTicketsLog = interaction.options.getChannel('tickets_log_channel');
    const dupTicketsToOrders = interaction.options.getBoolean('duplicate_ticket_to_orders_log');
    const autocreate = interaction.options.getBoolean('autocreate') ?? true;

    let category = null;
    let ordersLogChannel = null;
    let ticketsLogChannel = null;

    try {
      // Resolve or create Orders Category
      if (providedCategory) {
        if (providedCategory.type !== ChannelType.GuildCategory) {
          return interaction.editReply({ content: '❌ The orders_category must be a Category.' });
        }
        category = providedCategory;
      } else if (autocreate) {
        // Try find by name first
        category = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && /orders/i.test(c.name))
          || await interaction.guild.channels.create({ name: "King's Customs Orders", type: ChannelType.GuildCategory, reason: '/orders-setup autocreate' });
      }

      // Resolve or create Orders Log channel
      if (providedOrdersLog) {
        if (providedOrdersLog.type !== ChannelType.GuildText) {
          return interaction.editReply({ content: '❌ The orders_log_channel must be a Text channel.' });
        }
        ordersLogChannel = providedOrdersLog;
      } else if (autocreate) {
        ordersLogChannel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildText && /orders-?log/i.test(c.name))
          || await interaction.guild.channels.create({ name: 'orders-log', type: ChannelType.GuildText, reason: '/orders-setup autocreate' });
      }

      // Resolve Tickets Log channel (prefer provided, else default hardcoded ID, else create)
      if (providedTicketsLog) {
        if (providedTicketsLog.type !== ChannelType.GuildText) {
          return interaction.editReply({ content: '❌ The tickets_log_channel must be a Text channel.' });
        }
        ticketsLogChannel = providedTicketsLog;
      } else {
        const hardcoded = interaction.guild.channels.cache.get('1411101330558291978');
        if (hardcoded && hardcoded.type === ChannelType.GuildText) {
          ticketsLogChannel = hardcoded;
        } else if (autocreate) {
          ticketsLogChannel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildText && /tickets-?log/i.test(c.name))
            || await interaction.guild.channels.create({ name: 'tickets-log', type: ChannelType.GuildText, reason: '/orders-setup autocreate' });
        }
      }

      // Save what we resolved
      if (category) {
        await setSetting('orders_category_id', category.id);
      }
      if (ordersLogChannel) {
        await setSetting('orders_log_channel_id', ordersLogChannel.id);
      }
      if (ticketsLogChannel) {
        await setSetting('tickets_log_channel_id', ticketsLogChannel.id);
      }
      if (typeof dupTicketsToOrders === 'boolean') {
        await setSetting('duplicate_ticket_to_orders_log', dupTicketsToOrders ? '1' : '0');
      }

      const lines = [];
      if (category) lines.push(`• Orders Category: <#${category.id}>`);
      if (ordersLogChannel) lines.push(`• Orders Log Channel: <#${ordersLogChannel.id}>`);
      if (ticketsLogChannel) lines.push(`• Tickets Log Channel: <#${ticketsLogChannel.id}>`);
      if (typeof dupTicketsToOrders === 'boolean') lines.push(`• Duplicate Tickets to Orders Log: ${dupTicketsToOrders ? 'Yes' : 'No'}`);
      if (!lines.length) lines.push('• No changes were made. Provide channels or enable autocreate.');

      return interaction.editReply({ content: `✅ Orders setup saved.\n${lines.join('\n')}` });
    } catch (e) {
      console.error('orders-setup error:', e);
      return interaction.editReply({ content: '❌ Failed to complete orders setup. Please check my permissions and try again.' });
    }
  }
};
