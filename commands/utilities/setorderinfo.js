const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const priceManager = require('../../utils/priceManager');

// Hardcoded order categories with role IDs
const ORDER_CATEGORIES = {
  'Livery': '1457931808384483460',
  'Uniform': '1457932046063370504',
  'ELS': '1457931809202372799',
  'Graphics': '1457931804928381034',
  'Discord Server': '1457927114354327662',
  'Discord Bot': '1457930518245937300'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setorderinfo')
    .setDescription('Manage order item prices and statuses')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setprice')
        .setDescription('Set price for a category/item')
        .addStringOption(o => o.setName('category').setDescription('Category name').setRequired(true).setAutocomplete(true))
        .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
        .addIntegerOption(o => o.setName('price').setDescription('Price in Robux').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setstatus')
        .setDescription('Set status for a category/item')
        .addStringOption(o => o.setName('category').setDescription('Category name').setRequired(true).setAutocomplete(true))
        .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
        .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true)
          .addChoices(
            { name: 'Open', value: 'Open' },
            { name: 'Closed', value: 'Closed' },
            { name: 'Limited', value: 'Limited' }
          ))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View all prices and statuses')
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'category') {
      const categories = Object.keys(ORDER_CATEGORIES);
      const filtered = categories.filter(cat => cat.toLowerCase().includes(focusedOption.value.toLowerCase()));
      await interaction.respond(filtered.slice(0, 25).map(cat => ({ name: cat, value: cat })));
    }
  },

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({ content: '❌ You need management permissions.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setprice') {
      await interaction.deferReply({ ephemeral: true });
      
      const category = interaction.options.getString('category');
      const item = interaction.options.getString('item');
      const price = interaction.options.getInteger('price');

      if (!ORDER_CATEGORIES[category]) {
        return interaction.editReply({ content: `❌ Invalid category. Valid categories: ${Object.keys(ORDER_CATEGORIES).join(', ')}` });
      }

      if (price < 0) {
        return interaction.editReply({ content: '❌ Price must be 0 or greater.' });
      }

      await priceManager.setPrice(category, item, price);

      return interaction.editReply({
        content: `✅ Set price for **${category} > ${item}** to **${price} Robux**`
      });
    }

    if (subcommand === 'setstatus') {
      await interaction.deferReply({ ephemeral: true });
      
      const category = interaction.options.getString('category');
      const item = interaction.options.getString('item');
      const status = interaction.options.getString('status');

      if (!ORDER_CATEGORIES[category]) {
        return interaction.editReply({ content: `❌ Invalid category. Valid categories: ${Object.keys(ORDER_CATEGORIES).join(', ')}` });
      }

      await priceManager.setStatus(category, item, status);

      return interaction.editReply({
        content: `✅ Set status for **${category} > ${item}** to **${status}**`
      });
    }

    if (subcommand === 'view') {
      await interaction.deferReply({ ephemeral: true });
      
      const allData = await priceManager.getAllPrices();
      
      const embed = new EmbedBuilder()
        .setTitle('Order Item Prices & Statuses')
        .setColor(BRAND_COLOR_HEX)
        .setTimestamp();

      if (Object.keys(allData).length === 0) {
        embed.setDescription('No items configured yet. Use `/setorderinfo setprice` to add items.');
      } else {
        for (const [category, items] of Object.entries(allData)) {
          const itemList = Object.entries(items)
            .map(([itemName, data]) => `**${itemName}**: ${data.price || 0} Robux - ${data.status || 'Open'}`)
            .join('\n');
          
          if (itemList) {
            embed.addFields({ name: category, value: itemList, inline: false });
          }
        }
      }

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
