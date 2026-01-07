const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { requireTier } = require('../../utils/permissions');
const { ensureCategoryRoles } = require('../../utils/categoryRoleSync');
const { seedDefaultsIfEmpty, listCategories } = require('../../utils/priceManager');

// Unified interactive /setorderinfo panel (interactive-only)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setorderinfo')
    .setDescription('Owner/Management: manage order info categories and items (interactive)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !requireTier(interaction.member, 'management')) {
      // Reply ephemerally using flags
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }

    let deferred = false;
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
        deferred = true;
      }

      await seedDefaultsIfEmpty().catch(() => {});
      try { await ensureCategoryRoles(interaction.guild); } catch {}

      const { ensureCanonicalCategoryNames } = require('../../utils/priceManager');
      await ensureCanonicalCategoryNames().catch(()=>{});
      const cats = await listCategories();
      const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId(`soi_action:${interaction.user.id}`)
        .setPlaceholder('Choose an action')
        .addOptions([
          { label: 'List', value: 'list', description: 'List categories and items' },
          { label: 'Add Category', value: 'add_category' },
          { label: 'Rename Category', value: 'rename_category' },
          { label: 'Remove Category', value: 'remove_category' },
          { label: 'Add Item', value: 'add_item' },
          { label: 'Rename Item', value: 'rename_item' },
          { label: 'Remove Item', value: 'remove_item' },
          { label: 'Set Price', value: 'set_price' },
          { label: 'Set Status', value: 'set_status' },
          { label: 'Sync Roles', value: 'sync_roles' }
        ]);

      const catSelect = new StringSelectMenuBuilder()
        .setCustomId(`soi_category:${interaction.user.id}`)
        .setPlaceholder('Select a category (if needed)')
        .addOptions((cats.length ? cats : ['No categories']).map(c => ({ label: c, value: c })));

      const proceed = new ButtonBuilder().setCustomId(`soi_proceed:${interaction.user.id}:none:none`).setLabel('Proceed').setStyle(ButtonStyle.Primary);
      const cancel = new ButtonBuilder().setCustomId(`soi_cancel:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary);

      const panel = new EmbedBuilder().setTitle("King's Customs — Order Info Admin").setColor(BRAND_COLOR_HEX).setDescription('Select an action, optionally a category, then press Proceed.');

      const payload = {
        embeds: [panel],
        components: [
          new ActionRowBuilder().addComponents(actionSelect),
          new ActionRowBuilder().addComponents(catSelect),
          new ActionRowBuilder().addComponents(proceed, cancel)
        ]
      };

      if (deferred || interaction.deferred) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({ ...payload, flags: 64 });
      }

      return;
    } catch (e) {
      console.error('setorderinfo error:', e);
      try {
        if (deferred || interaction.deferred) return interaction.editReply({ content: '❌ Error processing request.' });
        if (interaction.replied) return interaction.followUp({ content: '❌ Error processing request.', flags: 64 });
        return interaction.reply({ content: '❌ Error processing request.', flags: 64 });
      } catch {}
    }
  }
};
