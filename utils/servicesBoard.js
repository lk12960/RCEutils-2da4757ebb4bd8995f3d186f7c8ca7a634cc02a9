const { EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { BRAND_COLOR_HEX } = require('./branding');
const { getSetting } = require('./settingsManager');
const { listCategories, seedDefaultsIfEmpty } = require('./priceManager');
const { getCategoryStatus } = require('./categoryStatusManager');

const EMOJI_TRIPLE = {
  red: '<:close1:1457478377433727168><:close2:1457478352389541889><:close3:1457478290095865897>',
  green: '<:open1:1457478173687283979><:open2:1457478228217430266><:open3:1457478319003140188>',
  yellow: '<:delayed1:1457478413584699601><:delayed2:1457478442751758484><:delayed3:1457478509592187004>'
};

const DEFAULT_DESCS = {
  'Livery': ' • Staff Livery\n • Team Liveries',
  'Uniform': '• Staff Uniforms\n• Team Uniforms\n• Custom Uniforms',
  'ELS': '• All Teams\n• Custom ELS',
  'Graphics': '• Server\n• Team\n• Custom',
  'Discord Server': '• Embeds\n• Channels\n• Roles\n• Permissions',
  'Discord Bot': '• Functions\n• Commands\n• Events',
};

function mapStatusToKey(status) {
  switch ((status || '').toLowerCase()) {
    case 'open':
    case 'green':
      return 'green';
    case 'delayed':
    case 'yellow':
      return 'yellow';
    default:
      return 'red';
  }
}

// No longer creating per-category channels; kept stub for compatibility
async function ensureServiceChannel() { return null; }

async function buildFields(guild, servicesCategoryId) {
  const { ensureCanonicalCategoryNames } = require('./priceManager');
  await seedDefaultsIfEmpty().catch(() => {});
  await ensureCanonicalCategoryNames().catch(()=>{});
  const categories = await listCategories();
  const fields = [];
  for (const catName of categories) {
    const raw = await getCategoryStatus(guild.id, catName);
    const statusKey = mapStatusToKey(raw);
    const desc = DEFAULT_DESCS[catName] || '• Items managed via Order Information';
    fields.push({ name: catName, value: `${EMOJI_TRIPLE[statusKey]}\n\n${desc}`, inline: true });
  }
  return fields;
}

async function refreshServicesBoard(guild) {
  const servicesChannelId = await getSetting('services_channel_id');
  const servicesMessageId = await getSetting('services_message_id');
  const servicesCategoryId = await getSetting('services_category_id');
  if (!servicesChannelId || !servicesMessageId || !servicesCategoryId) return false;

  const servicesChannel = guild.channels.cache.get(servicesChannelId);
  if (!servicesChannel || servicesChannel.type !== ChannelType.GuildText) return false;

  const msg = await servicesChannel.messages.fetch(servicesMessageId).catch(() => null);
  if (!msg) return false;

  const fields = await buildFields(guild, servicesCategoryId);

  const bannerEmbed = new EmbedBuilder()
    .setColor(BRAND_COLOR_HEX)
    .setImage('https://message.style/cdn/images/73c03054d041546292863ab6737c04d00e26b01bb9feb653a58b1ba7e37238c1.png');

  const contentEmbed = new EmbedBuilder()
    .setTitle("Welcome to King's Customs")
    .setColor(BRAND_COLOR_HEX)
    .setDescription("Let's make a fun and enjoyable experience for you. First off, while ordering an item, please be sure to acknowledge the rules and order information.")
    .addFields(fields)
    .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');

  // Rebuild the order select with updated statuses
  const cats = await listCategories();
  const orderOptions = [];
  for (const c of cats) {
    const status = (await getCategoryStatus(guild.id, c)) || 'closed';
    const label = status === 'closed' ? `${c} (Closed)` : status === 'delayed' ? `${c} (Delayed)` : c;
    orderOptions.push({ label, value: c, description: `Order ${c}` });
  }
  const selectOrder = new StringSelectMenuBuilder()
    .setCustomId('rd_ticket_select')
    .setPlaceholder("Start a King's Customs order")
    .addOptions(orderOptions.length ? orderOptions : [{ label: 'No categories', value: 'none', description: 'No categories available' }]);
  const row2 = new ActionRowBuilder().addComponents(selectOrder);

  const row1 = msg.components && msg.components[0] ? msg.components[0] : null;
  await msg.edit({ embeds: [bannerEmbed, contentEmbed], components: row1 ? [row1, row2] : [row2] });
  return true;
}

async function handleCategoryAdded(guild, name) {
  // Channel-less flow: just refresh board
  return refreshServicesBoard(guild);
}

async function handleCategoryRenamed(guild, oldName, newName) {
  // Channel-less flow: just refresh board
  return refreshServicesBoard(guild);
}

async function handleCategoryRemoved(guild, name) {
  // Channel-less flow: just refresh board
  return refreshServicesBoard(guild);
}

module.exports = { refreshServicesBoard, handleCategoryAdded, handleCategoryRenamed, handleCategoryRemoved, buildFields, ensureServiceChannel };
