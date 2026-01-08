const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');
const { getCategoryStatus } = require('../../utils/categoryStatusManager');
const { listCategories } = require('../../utils/priceManager');
const { createTicketChannel, buildTicketButtons, buildWelcomeEmbed, buildUserInfoEmbed, buildFormEmbed, resolveSupportCategory, createTicketChannelWithParent } = require('../../utils/ticketUtils');
const { isBlacklisted } = require('../../utils/ticketBlacklist');
const { getSetting } = require('../../utils/settingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open-ticket')
    .setDescription('Open a ticket for Order or Support')
    .addStringOption(o => o.setName('type').setDescription('Ticket type').addChoices(
      { name: 'Order', value: 'order' },
      { name: 'General Support', value: 'general' },
      { name: 'HR Support', value: 'hr' },
    ).setRequired(true))
    .addStringOption(o => o.setName('roblox_username').setDescription('Roblox Username').setRequired(true))
    .addStringOption(o => o.setName('details').setDescription('Details / Reason').setRequired(true))
    .addStringOption(o => o.setName('order_category').setDescription('Order category (if type=Order)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const type = interaction.options.getString('type', true);
    const roblox = interaction.options.getString('roblox_username', true);
    const details = interaction.options.getString('details', true);

    let deferred = false;

    // Blacklist check
    const scope = type === 'order' ? 'order' : 'support';
    const blocked = await isBlacklisted(interaction.user.id, scope).catch(()=>false);
    if (blocked) return interaction.reply({ content: '❌ You are blacklisted from opening this type of ticket.', flags: 64 });

    if (type === 'order') {
      // Determine category
      let category = interaction.options.getString('order_category');
      if (!category) {
        const cats = await listCategories();
        category = cats[0] || 'Order';
      }
      const status = (await getCategoryStatus(interaction.guild.id, category)) || 'closed';
      if (status === 'closed') return interaction.reply({ content: 'This order type is currently closed.', flags: 64 });

      if (!interaction.deferred && !interaction.replied) { try { await interaction.deferReply({ flags: 64 }); deferred = true; } catch {} }

      const ch = await createTicketChannel(interaction.guild, interaction.user, category);
      const { getCategoryRole } = require('../../utils/categoryRoleSync');
      const roleId = getCategoryRole(category);
      const welcome = buildWelcomeEmbed(interaction.user, category);
      const info = buildUserInfoEmbed(interaction.member || interaction.user);
      const form = buildFormEmbed({ roblox, details, deadline: 'N/A' });
      const buttons = buildTicketButtons(ch.id);
      await ch.send({ content: `${interaction.user}${roleId ? ` <@&${roleId}>` : ''}`, embeds: [welcome, info, form], components: [buttons] });
      if (interaction.deferred || interaction.replied || deferred) return interaction.editReply({ content: `✅ Ticket created: ${ch}` });
      return interaction.reply({ content: `✅ Ticket created: ${ch}`, flags: 64 });
    } else {
      if (!interaction.deferred && !interaction.replied) { try { await interaction.deferReply({ flags: 64 }); deferred = true; } catch {} }
      const parent = await resolveSupportCategory(interaction.guild) || await interaction.guild.channels.create({ name: 'Support', type: 4, reason: 'Create Support category' });
      const category = type === 'general' ? 'General Support' : 'HR Support';
      const { ensureSupportRoles } = require('../../utils/categoryRoleSync');
      try { await ensureSupportRoles(interaction.guild); } catch {}
      const ch = await createTicketChannelWithParent(interaction.guild, interaction.user, category, parent.id);
      const { getSupportRoles } = require('../../utils/categoryRoleSync');
      const supportRoles = getSupportRoles();
      const roleId = supportRoles[category];
      const { EmbedBuilder } = require('discord.js');
      const welcome = new EmbedBuilder().setTitle(`Support — ${category}`).setColor(0x00A2FF);
      const info = new EmbedBuilder().setTitle('User Information').addFields({ name: 'Roblox Username', value: roblox }).setColor(0x00A2FF);
      const form = new EmbedBuilder().setTitle('Details').addFields({ name: 'Reason', value: details }).setColor(0x00A2FF);
      const buttons = buildTicketButtons(ch.id);
      await ch.send({ content: `${interaction.user}${roleId ? ` <@&${roleId}>` : ''}`, embeds: [welcome, info, form], components: [buttons] });
      if (interaction.deferred || interaction.replied || deferred) return interaction.editReply({ content: `✅ Support ticket created: ${ch}` });
      return interaction.reply({ content: `✅ Support ticket created: ${ch}`, flags: 64 });
    }
  }
};
