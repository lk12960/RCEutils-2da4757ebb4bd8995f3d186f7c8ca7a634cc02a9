const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { setSetting } = require('../../utils/settingsManager');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { seedDefaultsIfEmpty, getItemsForCategory, listCategories } = require('../../utils/priceManager');
const { buildFields, ensureServiceChannel } = require('../../utils/servicesBoard');

const SERVICE_CHANNEL_NAME = 'services';

const SERVICE_DEFS = [
  { key: 'Livery', channelName: 'Livery: 🔴', desc: ' • Staff Livery\n • Team Liveries' },
  { key: 'Uniform', channelName: 'Uniform: 🔴', desc: '• Staff Uniforms\n• Team Uniforms\n• Custom Uniforms' },
  { key: 'ELS', channelName: 'ELS: 🔴', desc: '• All Teams\n• Custom ELS' },
  { key: 'Graphics', channelName: 'Graphics: 🔴', desc: '• Server\n• Team\n• Custom' },
  { key: 'Discord Servers', channelName: 'Discord Server: 🔴', desc: '• Embeds\n• Channels\n• Roles\n• Permissions' },
  { key: 'Discord Bots', channelName: 'Discord Bots: 🔴', desc: '• Functions\n• Commands\n• Events' },
];

const EMOJI_TRIPLE = {
  red: '<:close1:1457478377433727168><:close2:1457478352389541889><:close3:1457478290095865897>',
  green: '<:open1:1457478173687283979><:open2:1457478228217430266><:open3:1457478319003140188>',
  yellow: '<:delayed1:1457478413584699601><:delayed2:1457478442751758484><:delayed3:1457478509592187004>'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupbot')
    .setDescription("Owner/Management: Set up King's Customs services system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to run setup.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    // Create services category
    const category = await interaction.guild.channels.create({
      name: "King's Customs Services",
      type: ChannelType.GuildCategory,
      reason: 'Initial setup by /setupbot'
    });

    // Ensure orders category exists
    let ordersCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && /orders/i.test(c.name));
    if (!ordersCategory) {
      ordersCategory = await interaction.guild.channels.create({ name: "King's Customs Orders", type: ChannelType.GuildCategory, reason: 'Orders category creation' });
    }

    // Ensure orders log channel exists
    let ordersLog = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildText && /orders-?log/i.test(c.name));
    if (!ordersLog) {
      ordersLog = await interaction.guild.channels.create({ name: 'orders-log', type: ChannelType.GuildText, reason: 'Orders log channel' });
    }

    // No per-category channels anymore. Seed defaults only.
    await seedDefaultsIfEmpty();
    // Create or find services channel
    let servicesChannel = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === SERVICE_CHANNEL_NAME);
    if (!servicesChannel) {
      servicesChannel = await interaction.guild.channels.create({ name: SERVICE_CHANNEL_NAME, type: ChannelType.GuildText, reason: 'Services channel creation' });
    }

    // Build main embeds dynamically (banner + content)
    const fields = await buildFields(interaction.guild, category.id);

    const bannerEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR_HEX)
      .setImage('https://message.style/cdn/images/73c03054d041546292863ab6737c04d00e26b01bb9feb653a58b1ba7e37238c1.png');

    const mainEmbed = new EmbedBuilder()
      .setTitle("Welcome to King's Customs")
      .setDescription("Let's make a fun and enjoyable experience for you. First off, while ordering an item, please be sure to acknowledge the rules and order information.")
      .setColor(BRAND_COLOR_HEX)
      .addFields(fields)
      .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');

    // Action row with a single select to show Order Information
        const selectInfo = new StringSelectMenuBuilder()
      .setCustomId('rd_order_info')
      .setPlaceholder('View more order information!')
      .addOptions([
        { label: 'Order Information', value: 'order_info', description: 'Prices, departments, and more.' }
      ]);

    const { listCategories } = require('../../utils/priceManager');
    const { getCategoryStatus } = require('../../utils/categoryStatusManager');
    const cats = await listCategories();
    const orderOptions = [];
    for (const c of cats) {
      const status = (await getCategoryStatus(interaction.guild.id, c)) || 'closed';
      const label = status === 'closed' ? `${c} (Closed)` : status === 'delayed' ? `${c} (Delayed)` : c;
      orderOptions.push({ label, value: c, description: `Order ${c}` });
    }
    const selectOrder = new StringSelectMenuBuilder()
      .setCustomId('rd_ticket_select')
      .setPlaceholder("Start a King's Customs order")
      .addOptions(orderOptions.length ? orderOptions : [{ label: 'No categories', value: 'none', description: 'No categories available' }]);

    const row1 = new ActionRowBuilder().addComponents(selectInfo);
    const row2 = new ActionRowBuilder().addComponents(selectOrder);

    // Post banner + main embeds together
    const posted = await servicesChannel.send({ embeds: [bannerEmbed, mainEmbed], components: [row1, row2] });

    // Save settings: channel and message ids, category id
    await setSetting('services_channel_id', servicesChannel.id);
    await setSetting('services_message_id', posted.id);
    await setSetting('services_category_id', category.id);

    // Save orders config
    await setSetting('orders_category_id', ordersCategory.id);
    await setSetting('orders_log_channel_id', ordersLog.id);

    // Interaction handling moved to global events/interactionCreate.js for persistence across restarts.

    await interaction.editReply({ content: '✅ Setup completed. The services channel and category were created.' });
  }
};
