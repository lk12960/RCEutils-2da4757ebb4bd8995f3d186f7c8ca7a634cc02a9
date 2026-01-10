const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { setCategoryStatus, getCategoryStatus } = require('../../utils/categoryStatusManager');
const { listCategories } = require('../../utils/priceManager');

// Hardcoded order categories with role IDs
const ORDER_CATEGORIES = {
  'Livery': '1457931808384483460',
  'Uniform': '1457932046063370504',
  'ELS': '1457931809202372799',
  'Graphics': '1457931804928381034',
  'Discord Server': '1457927114354327662',
  'Discord Bot': '1457930518245937300'
};

// Status emojis
const STATUS_EMOJIS = {
  'open': '<:open1:1457478173687283979><:open2:1457478228217430266><:open3:1457478319003140188>',
  'delayed': '<:delayed1:1457478413584699601><:delayed2:1457478442751758484><:delayed3:1457478509592187004>',
  'closed': '<:close1:1457478377433727168><:close2:1457478352389541889><:close3:1457478290095865897>'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setorderinfo')
    .setDescription('Manage order category statuses (Open, Delayed, Closed)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      return interaction.reply({ content: '❌ You need management permissions.', ephemeral: true });
    }

    // Get all categories (auto-defer will kick in if this takes >2s)
    const categories = await listCategories();
    
    if (!categories || categories.length === 0) {
      const replyMethod = interaction.deferred ? 'editReply' : 'reply';
      return interaction[replyMethod]({ content: '❌ No order categories found.', ephemeral: true });
    }

    // Build embed showing current statuses
    const embed = new EmbedBuilder()
      .setTitle('Order Category Status Manager')
      .setDescription('Select a category below to change its status.')
      .setColor(BRAND_COLOR_HEX)
      .setTimestamp();

    const statusLines = [];
    for (const cat of categories) {
      const status = (await getCategoryStatus(interaction.guild.id, cat)) || 'closed';
      const emoji = STATUS_EMOJIS[status.toLowerCase()] || STATUS_EMOJIS['closed'];
      statusLines.push(`${emoji} **${cat}** - ${status.charAt(0).toUpperCase() + status.slice(1)}`);
    }

    embed.addFields({ name: 'Current Statuses', value: statusLines.join('\n'), inline: false });

    // Build dropdown to select category
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`setorderinfo_select:${interaction.user.id}`)
      .setPlaceholder('Select a category to update')
      .addOptions(categories.map(cat => ({
        label: cat,
        value: cat,
        description: `Change status for ${cat}`
      })));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const replyMethod = interaction.deferred ? 'editReply' : 'reply';
    return interaction[replyMethod]({ embeds: [embed], components: [row], ephemeral: true });
  }
};
