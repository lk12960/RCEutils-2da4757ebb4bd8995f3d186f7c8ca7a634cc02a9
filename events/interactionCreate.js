const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { refreshServicesBoard } = require('../utils/servicesBoard');
const { getCategoryStatus } = require('../utils/categoryStatusManager');
const { BRAND_COLOR_HEX } = require('../utils/branding');
const { seedDefaultsIfEmpty, getItemsForCategory } = require('../utils/priceManager');
const { buildOpenOrderModal, createTicketChannel, buildTicketButtons, buildWelcomeEmbed, buildUserInfoEmbed, buildFormEmbed, getTicketMeta, logAndCloseTicket } = require('../utils/ticketUtils');

console.log('[interactionCreate.js] build:', new Date().toISOString());
module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      try { await (require('../utils/stats').track)('command', 1, interaction.guild?.id); } catch {}

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Auto-defer guard: if command doesn't acknowledge within 2s, defer ephemerally
      let autoDeferred = false;
      const timer = setTimeout(async () => {
        if (!interaction.deferred && !interaction.replied) {
          try { await interaction.deferReply({ flags: 64 }); autoDeferred = true; } catch {}
        }
      }, 2000);

      try {
        await command.execute(interaction, client);
      } catch (e) {
        console.error(e);
        try {
          if (interaction.deferred || interaction.replied || autoDeferred) {
            await interaction.followUp({ content: 'There was an error while executing this command.', flags: 64 });
          } else {
            await interaction.reply({ content: 'There was an error while executing this command.', flags: 64 });
          }
        } catch {}
      } finally {
        clearTimeout(timer);
      }
      return;
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('botsetup_select:')) {
        const [, uid] = interaction.customId.split(':');
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', flags: 64 });
        const choice = interaction.values[0];
        // Dispatch to existing setup flows inline by reusing their logic
        if (choice === 'services') {
          const mod = require('../commands/utilities/setupbot');
          // Call execute of setupbot with the original interaction by creating a pseudo sub-command flow: re-run the logic
          try { await mod.execute(interaction); } catch (e) { console.error('botsetup services error:', e); try { await interaction.editReply({ content: '❌ Failed to run Services setup.' }); } catch {} }
          return;
        }
        if (choice === 'orders') {
          const mod = require('../commands/utilities/orders-setup');
          try { await mod.execute(interaction); } catch (e) { console.error('botsetup orders error:', e); try { await interaction.editReply({ content: '❌ Failed to run Orders setup.' }); } catch {} }
          return;
        }
        if (choice === 'support') {
          const mod = require('../commands/utilities/support-setup');
          try { await mod.execute(interaction); } catch (e) { console.error('botsetup support error:', e); try { await interaction.editReply({ content: '❌ Failed to run Support setup.' }); } catch {} }
          return;
        }
      }

      if (interaction.customId === 'rd_order_info') {
        try {
          await seedDefaultsIfEmpty();
          const robux = '<:robux:1361349631682019619>';
          const compose = async (cat, prefix) => {
            const rows = await getItemsForCategory(cat);
            if (!rows.length) return `${prefix} - N/A`;
            return rows.map(r => `${prefix} ${r.item} = ${r.price}  ${robux}`).join('\n');
          };

          const banner = new EmbedBuilder().setColor(BRAND_COLOR_HEX).setImage('https://message.style/cdn/images/158cc7a5b055292aac3b7e5ba647d3dea81bff54a029c30ac784cefd5c501ed0.png');
          const infoEmbed = new EmbedBuilder()
            .setTitle('Order Information.')
            .setDescription('Orders of 10 or higher items may apply to the bulk discount, if we agree. Priority is 20% more on total price to help speed the process up.')
            .setColor(BRAND_COLOR_HEX)
            .addFields([
              { name: 'Livery', value: await compose('Livery', '🚓'), inline: true },
              { name: 'Uniform', value: await compose('Uniform', '👔'), inline: true },
              { name: 'ELS', value: await compose('ELS', '🚨'), inline: true },
              { name: 'Graphics', value: await compose('Graphics', '📸'), inline: true },
              { name: 'Discord Servers', value: await compose('Discord Servers', '📂'), inline: true },
              { name: 'Discord Bots', value: await compose('Discord Bots', '🤖'), inline: true },
            ])
            .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');

          return interaction.reply({ embeds: [banner, infoEmbed], flags: 64 });
        } catch (e) {
          console.error('order_info select error:', e);
          return interaction.reply({ content: '❌ Failed to load order information.', flags: 64 });
        }
      }
      if (interaction.customId.startsWith('soi_action:')) {
        const uid = interaction.customId.split(':')[1];
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', ephemeral: true });
        // Update Proceed button action
        const comps = interaction.message.components.map(r => ActionRowBuilder.from(r.toJSON ? r.toJSON() : r));
        const actionRow = comps[0];
        const catRow = comps[1];
        const btnRow = comps[2];
        const action = interaction.values[0];
        // find proceed button
        const proceed = btnRow.components.find(c => c.data?.custom_id?.startsWith('soi_proceed:') || c.customId?.startsWith('soi_proceed:'));
        let current = proceed.data?.custom_id || proceed.customId;
        const parts = current.split(':');
        // format soi_proceed:<uid>:<action>:<category>
        const category = parts[3] && parts[3] !== 'none' ? parts[3] : 'none';
        const newId = `soi_proceed:${uid}:${action}:${category}`;
        if (proceed.data) proceed.data.custom_id = newId; else proceed.setCustomId(newId);
        return interaction.update({ components: comps });
      }
      if (interaction.customId.startsWith('soi_category:')) {
        const uid = interaction.customId.split(':')[1];
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', ephemeral: true });
        const comps = interaction.message.components.map(r => ActionRowBuilder.from(r.toJSON ? r.toJSON() : r));
        const btnRow = comps[2];
        const category = interaction.values[0];
        const proceed = btnRow.components.find(c => c.data?.custom_id?.startsWith('soi_proceed:') || c.customId?.startsWith('soi_proceed:'));
        let current = proceed.data?.custom_id || proceed.customId;
        const parts = current.split(':');
        const action = parts[2] && parts[2] !== 'none' ? parts[2] : 'list';
        const newId = `soi_proceed:${uid}:${action}:${category}`;
        if (proceed.data) proceed.data.custom_id = newId; else proceed.setCustomId(newId);
        return interaction.update({ components: comps });
      }
      if (interaction.customId === 'rd_ticket_select') {
        try {
          const sel = interaction.values && interaction.values[0];
          const category = sel && sel !== 'none' ? sel : null;
          if (!category) return interaction.reply({ content: 'No categories available right now.', flags: 64 });

          const status = (await require('../utils/categoryStatusManager').getCategoryStatus(interaction.guild.id, category)) || 'closed';

          if (status === 'closed') {
            return interaction.reply({ content: `❌ ${category} is currently closed.`, flags: 64 });
          }
          if (status === 'delayed') {
            // Ask for confirmation before proceeding when delayed
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`ticket_delay_confirm:${category}`).setLabel('Proceed Anyway').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('ticket_delay_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );
            const embed = new EmbedBuilder().setTitle(`${category} — Delayed`).setDescription('This service is currently delayed. You can still proceed to open a ticket, or cancel.').setColor(0xFFAA00);
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
          }

          // status open: show modal directly (cannot have already replied)
          const { buildOpenOrderModal } = require('../utils/ticketUtils');
          const modal = buildOpenOrderModal(category);
          return interaction.showModal(modal);
        } catch (e) {
          console.error('rd_ticket_select error:', e);
          try { return interaction.reply({ content: '❌ Failed to proceed.', flags: 64 }); } catch {}
        }
      }
      if (interaction.customId === 'support_select') {
        // Support categories are always open, create a simpler modal
        const category = interaction.values[0]; // 'General Support' | 'HR Support'
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder().setCustomId(`support_open_modal:${category}`).setTitle(`Start ${category} Ticket`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roblox').setLabel('Roblox Username').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason for the ticket').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        );
        return interaction.showModal(modal);
      }
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('payout_approve:')) {
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const { decidePayout, getPayoutById } = require('../utils/payoutManager');
        await decidePayout(Number(payoutId), 'APPROVED', interaction.user.id, null);
        const payout = await getPayoutById(Number(payoutId));
        try {
          const user = await interaction.client.users.fetch(requesterId).catch(()=>null);
          if (user) {
            const { EmbedBuilder } = require('discord.js');
            const dm = new EmbedBuilder()
              .setTitle('Payout Approved')
              .setDescription(`Your payout request has been approved and payment delivered.`)
              .addFields(
                { name: 'Orders', value: String(payout.order_count), inline: true },
                { name: 'Payout (Robux)', value: String(payout.payout_amount), inline: true },
              )
              .setFooter({ text: `Approved by ${interaction.user.tag}` });
            await user.send({ embeds: [dm] }).catch(()=>{});
          }
        } catch {}
        // Log to channel
        try {
          const logCh = interaction.client.channels.cache.get('1458207384982786282');
          if (logCh && logCh.isTextBased()) {
            const { EmbedBuilder } = require('discord.js');
            const e = new EmbedBuilder()
              .setTitle('Designer Payout Completed')
              .addFields(
                { name: 'Designer', value: `<@${payout.designer_id}>`, inline: true },
                { name: 'Orders', value: String(payout.order_count), inline: true },
                { name: 'Amount (Robux)', value: String(payout.payout_amount), inline: true },
                { name: 'Approved By', value: `${interaction.user}`, inline: true },
              )
              .setTimestamp(new Date());
            await logCh.send({ embeds: [e] });
          }
        } catch {}
        return interaction.reply({ content: '✅ Marked as completed.', flags: 64 });
      }

      if (interaction.customId.startsWith('payout_deny:')) {
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder().setCustomId(`payout_deny_modal:${payoutId}:${requesterId}`).setTitle('Deny Payout — Reason');
        modal.addComponents(new (require('discord.js').ActionRowBuilder)().addComponents(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setLabel('Reason').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('log_order:')) {
        const [, orderId, designerId] = interaction.customId.split(':');
        if (interaction.user.id !== designerId) return interaction.reply({ content: 'Only the assigned designer may log this order.', flags: 64 });
        try {
          const { getPayment, tryMarkLogged } = require('../utils/paymentManager');
          const { getSetting } = require('../utils/settingsManager');
          const payment = await getPayment(orderId);
          if (!payment) return interaction.reply({ content: 'Order not found.', flags: 64 });
          if (payment.status !== 'CONFIRMED' && payment.status !== 'LOGGED') return interaction.reply({ content: 'Payment not confirmed yet.', flags: 64 });
          const marked = await tryMarkLogged(orderId);
          if (!marked) return interaction.reply({ content: 'This order was already logged.', flags: 64 });
          const logId = await getSetting('orders_log_channel_id');
          const logChannel = logId ? interaction.client.channels.cache.get(logId) : null;
          if (!logChannel || !logChannel.isTextBased()) return interaction.reply({ content: 'Orders log channel not available.', flags: 64 });
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('Order Logged')
            .setColor(BRAND_COLOR_HEX)
            .addFields(
              { name: 'Purchaser (Roblox)', value: payment.roblox_username, inline: true },
              { name: 'Designer', value: `<@${designerId}>`, inline: true },
              { name: 'Price', value: `${payment.price} Robux`, inline: true },
              { name: 'Reason', value: payment.reason }
            )
            .setFooter({ text: `Order ID: ${orderId}` });
          await logChannel.send({ embeds: [embed] });
          return interaction.reply({ content: '✅ Order logged to Orders Log.', flags: 64 });
        } catch (e) {
          console.error('log_order button error:', e);
          return interaction.reply({ content: '❌ Failed to log order.', flags: 64 });
        }
      }

      if (interaction.customId.startsWith('catrole_select:')) {
        const [, uid] = interaction.customId.split(':');
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', flags: 64 });
        const comps = interaction.message.components.map(r => ActionRowBuilder.from(r.toJSON ? r.toJSON() : r));
        const rowRole = comps[1];
        // Store selected category in Save button customId
        const rowButtons = comps[2];
        const btn = rowButtons.components.find(c => (c.data?.custom_id||c.customId||'').startsWith('catrole_save:'));
        const newId = `catrole_save:${uid}:${interaction.values[0]}`;
        if (btn.data) btn.data.custom_id = newId; else btn.setCustomId(newId);
        return interaction.update({ components: comps });
      }
      if (interaction.customId.startsWith('catrole_role:')) {
        // Nothing to do immediately; role is carried by interaction.values or resolved roles
        return interaction.reply({ content: 'Role selected. Click Save Mapping to apply.', flags: 64, ephemeral: undefined }).catch(()=>{});
      }
      if (interaction.customId.startsWith('catrole_save:')) {
        const parts = interaction.customId.split(':');
        const uid = parts[1];
        const category = parts[2];
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', flags: 64 });
        const roleId = interaction.message.components?.[1]?.components?.[0]?.values?.[0] || (interaction.values && interaction.values[0]);
        // Fallback: read from resolved roles if present
        let selectedRoleId = roleId;
        if (!selectedRoleId && interaction.roles && interaction.roles.size) {
          selectedRoleId = interaction.roles.first().id;
        }
        if (!selectedRoleId) return interaction.reply({ content: 'Please select a role first.', flags: 64 });
        await (require('../utils/categoryRoleSync').setCategoryRole)(interaction.guild.id, category, selectedRoleId);
        return interaction.reply({ content: `✅ Mapped '${category}' → <@&${selectedRoleId}>.`, flags: 64 });
      }

      if (interaction.customId.startsWith('soi_proceed:')) {
        const [, uid, action, category] = interaction.customId.split(':');
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', ephemeral: true });
        const { listCategories, getItemsForCategory, setPrice, addItem, removeItem, renameItem, renameCategory, removeCategory } = require('../utils/priceManager');
        const { setCategoryStatus } = require('../utils/categoryStatusManager');
        const { ensureCategoryRoles, renameCategoryRole } = require('../utils/categoryRoleSync');
        const { refreshServicesBoard } = require('../utils/servicesBoard');

        // Helpers
        const ensureCatSelected = () => {
          if (!category || category === 'none' || category === 'No categories') {
            return interaction.reply({ content: 'Please select a category first.', ephemeral: true });
          }
          return null;
        };

        if (action === 'list') {
          // Paginate categories with 5 per page
          const cats = await listCategories();
          const page = 0;
          const per = 5;
          const pages = Math.max(1, Math.ceil(cats.length / per));
          const start = page * per;
          const slice = cats.slice(start, start + per);
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder().setTitle("King's Customs — Categories").setColor(BRAND_COLOR_HEX);
          for (const c of slice) {
            const rows = await getItemsForCategory(c);
            embed.addFields({ name: c, value: rows.length ? rows.map(r => `• ${r.item} = ${r.price}`).join('\n') : '(no items)' });
          }
          const prev = new ButtonBuilder().setCustomId(`soi_page:${uid}:${page-1}`).setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(page<=0);
          const next = new ButtonBuilder().setCustomId(`soi_page:${uid}:${page+1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page>=pages-1);
          return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(prev, next)], ephemeral: true });
        }
        if (action === 'add_category') {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:add_category:${uid}`).setTitle('Add Category');
          const name = new TextInputBuilder().setCustomId('name').setLabel('Category name').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(name));
          return interaction.showModal(modal);
        }
        if (action === 'rename_category') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:rename_category:${uid}:${category}`).setTitle('Rename Category');
          const input = new TextInputBuilder().setCustomId('new').setLabel('New category name').setStyle(TextInputStyle.Short).setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        if (action === 'remove_category') {
          const err = ensureCatSelected(); if (err) return;
          await removeCategory(category);
          const db = require('../database/db');
          await new Promise((resolve) => db.run(`DELETE FROM bot_category_status WHERE guild_id = ? AND category = ?`, [interaction.guild.id, category], () => resolve()));
          await refreshServicesBoard(interaction.guild);
          await ensureCategoryRoles(interaction.guild);
          return interaction.reply({ content: `✅ Category '${category}' removed.`, ephemeral: true });
        }
        if (action === 'add_item') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:add_item:${uid}:${category}`).setTitle('Add Item');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item').setLabel('Item name').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel('Price').setStyle(TextInputStyle.Short).setRequired(true)),
          );
          return interaction.showModal(modal);
        }
        if (action === 'rename_item') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:rename_item:${uid}:${category}`).setTitle('Rename Item');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('old').setLabel('Old item name').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new').setLabel('New item name').setStyle(TextInputStyle.Short).setRequired(true)),
          );
          return interaction.showModal(modal);
        }
        if (action === 'remove_item') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:remove_item:${uid}:${category}`).setTitle('Remove Item');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item').setLabel('Item name').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }
        if (action === 'set_price') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:set_price:${uid}:${category}`).setTitle('Set Price');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item').setLabel('Item name').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel('New price').setStyle(TextInputStyle.Short).setRequired(true)),
          );
          return interaction.showModal(modal);
        }
        if (action === 'set_status') {
          const err = ensureCatSelected(); if (err) return;
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder().setCustomId(`soi_modal:set_status:${uid}:${category}`).setTitle('Set Status (open/delayed/closed)');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('status').setLabel('Status (open|delayed|closed)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }
        if (action === 'sync_roles') {
          return interaction.reply({ content: 'ℹ️ Role auto-sync has been disabled. Use /category-roles to map categories to existing roles.', flags: 64 });
        }
        return;
      }
      if (interaction.customId.startsWith('stats_select:')) {
        const [, uid, sinceIso] = interaction.customId.split(':');
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', flags: 64 });
        const group = interaction.values[0];
        // group selection handled below; no external groups module
        const { summarize } = require('../utils/stats');
        const totals = await summarize(interaction.guild.id, sinceIso || null);
        const embed = (require('../commands/utilities/statistics').__proto__ && require('../commands/utilities/statistics')) ? null : null;
        const { BRAND_COLOR_HEX } = require('../utils/branding');
        const e = new (require('discord.js').EmbedBuilder)().setTitle("King's Customs — Statistics").setColor(BRAND_COLOR_HEX);
        if (sinceIso) e.setDescription(`Since ${sinceIso}`);
        const t = (k)=> (totals[k]||0);
        if (group==='all') {
          e.addFields(
            { name: 'Members Gained', value: String(t('member_join')), inline: true },
            { name: 'Members Lost', value: String(t('member_leave')), inline: true },
            { name: 'Messages Sent', value: String(t('message')), inline: true },
            { name: 'Commands Executed', value: String(t('command')), inline: true },
            { name: 'Bans', value: String(t('ban')), inline: true },
            { name: 'Kicks', value: String(t('kick')), inline: true },
            { name: 'Warnings', value: String(t('warn')), inline: true },
            { name: 'Mutes', value: String(t('mute')), inline: true },
            { name: 'Tickets Opened', value: String(t('ticket_open')), inline: true },
            { name: 'Orders Made', value: String(t('order')), inline: true },
            { name: 'Total Robux Made', value: String(t('robux_made')), inline: true },
            { name: 'Reviews Made', value: String(t('review')), inline: true },
            { name: '5★ Reviews', value: String(t('review_5')), inline: true },
            { name: 'Infractions Issued', value: String(t('infraction')), inline: true },
            { name: 'Users Ticket Blacklisted', value: String(t('ticket_blacklisted')), inline: true },
            { name: 'Moderations Voided', value: String(t('moderation_voided')), inline: true },
            { name: 'Infractions Voided', value: String(t('infraction_voided')), inline: true },
          );
        } else {
          const groups = {
            membership: ['member_join','member_leave'],
            messages_commands: ['message','command'],
            moderation: ['ban','kick','warn','mute','moderation_voided'],
            tickets_orders: ['ticket_open','order','robux_made'],
            reviews: ['review','review_5'],
            infractions: ['infraction','infraction_voided','ticket_blacklisted'],
          };
          for (const k of groups[group]||[]) e.addFields({ name: k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), value: String(t(k)), inline: true });
        }
        return interaction.update({ embeds: [e] });
      }

      if (interaction.customId.startsWith('soi_page:')) {
        const [, uid, pageStr] = interaction.customId.split(':');
        if (uid !== interaction.user.id) return interaction.reply({ content: 'This panel is not yours.', ephemeral: true });
        const { listCategories, getItemsForCategory } = require('../utils/priceManager');
        const cats = await listCategories();
        const page = Math.max(0, parseInt(pageStr, 10) || 0);
        const per = 5;
        const pages = Math.max(1, Math.ceil(cats.length / per));
        const p = Math.min(page, pages - 1);
        const start = p * per;
        const slice = cats.slice(start, start + per);
        const embed = new (require('discord.js').EmbedBuilder)().setTitle("King's Customs — Categories").setColor(BRAND_COLOR_HEX);
        for (const c of slice) {
          const rows = await getItemsForCategory(c);
          embed.addFields({ name: c, value: rows.length ? rows.map(r => `• ${r.item} = ${r.price}`).join('\n') : '(no items)' });
        }
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const prev = new ButtonBuilder().setCustomId(`soi_page:${uid}:${p-1}`).setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(p<=0);
        const next = new ButtonBuilder().setCustomId(`soi_page:${uid}:${p+1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(p>=pages-1);
        return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(prev, next)], ephemeral: true });
      }
      if (interaction.customId === 'ticket_delay_confirm:'.slice(0)) {
        // fallthrough placeholder to avoid accidental match
      }
      if (interaction.customId.startsWith('ticket_delay_confirm:')) {
        const category = interaction.customId.split(':')[1];
        const modal = buildOpenOrderModal(category);
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'ticket_delay_cancel') {
        return interaction.update({ content: 'Cancelled.', components: [] });
      }
      if (interaction.customId.startsWith('ticket_claim:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const meta = await getTicketMeta(interaction.channel);
        meta.claimedBy = interaction.user.id;
        try { await interaction.channel.setTopic(JSON.stringify(meta)); } catch {}
        return interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>.`, ephemeral: false });
      }
      if (interaction.customId.startsWith('ticket_close_reason:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`ticket_close_modal:${channelId}`).setTitle('Close Ticket (Reason)');
        const input = new TextInputBuilder().setCustomId('reason').setLabel('Close reason').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      if (interaction.customId.startsWith('ticket_close:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_close_confirm:${channelId}`).setLabel('Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Nevermind').setStyle(ButtonStyle.Secondary),
        );
        const embed = new EmbedBuilder().setTitle('Confirm Close').setDescription('Are you sure you want to close this ticket?').setColor(0xFFAA00);
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
      if (interaction.customId.startsWith('ticket_close_confirm:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const meta = await getTicketMeta(interaction.channel);
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason: null });
      }
      if (interaction.customId === 'ticket_close_cancel') {
        return interaction.update({ content: 'Close cancelled.', components: [] });
      }
      if (interaction.customId.startsWith('close_req_confirm:')) {
        const [, chId] = interaction.customId.split(':');
        if (interaction.channel.id !== chId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const meta = await getTicketMeta(interaction.channel);
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason: 'Closed by request' });
      }
      if (interaction.customId.startsWith('close_req_keep:')) {
        const [, chId] = interaction.customId.split(':');
        if (interaction.channel.id !== chId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const { clearChannelTimer } = require('../utils/ticketTimers');
        clearChannelTimer(chId);
        return interaction.update({ content: 'Okay, keeping the ticket open.', components: [] });
      }
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      // Admin: /setorderinfo interactive modals
      if (interaction.customId.startsWith('soi_modal:')) {
        try {
          const parts = interaction.customId.split(':');
          // formats:
          // soi_modal:add_category:<uid>
          // soi_modal:rename_category:<uid>:<category>
          // soi_modal:add_item:<uid>:<category>
          // soi_modal:rename_item:<uid>:<category>
          // soi_modal:remove_item:<uid>:<category>
          // soi_modal:set_price:<uid>:<category>
          // soi_modal:set_status:<uid>:<category>
          const action = parts[1];
          const uid = parts[2];
          const category = parts[3];
          if (uid !== interaction.user.id) {
            return interaction.reply({ content: 'This panel is not yours.', flags: 64 });
          }

          const priceMgr = require('../utils/priceManager');
          const { setCategoryStatus } = require('../utils/categoryStatusManager');
          const { ensureCategoryRoles, renameCategoryRole } = require('../utils/categoryRoleSync');
          const { handleCategoryAdded, handleCategoryRenamed, handleCategoryRemoved, refreshServicesBoard } = require('../utils/servicesBoard');

          if (action === 'add_category') {
            const name = interaction.fields.getTextInputValue('name').trim();
            if (!name) return interaction.reply({ content: 'Category name is required.', ephemeral: true });
            // Ensure at least status/role exist and refresh board
            await setCategoryStatus(interaction.guild.id, name, 'closed');
            try { await interaction.guild.roles.create({ name, reason: 'Create category role on add' }); } catch {}
            await refreshServicesBoard(interaction.guild);
            return interaction.reply({ content: `✅ Category '${name}' added and set to Closed.`, ephemeral: true });
          }

          if (action === 'rename_category') {
            const newName = interaction.fields.getTextInputValue('new').trim();
            if (!newName) return interaction.reply({ content: 'New name is required.', ephemeral: true });
            const oldName = category;
            const changes = await priceMgr.renameCategory(oldName, newName);
            // rename status row as well, if exists
            const db = require('../database/db');
            await new Promise((resolve) => db.run(`UPDATE bot_category_status SET category = ? WHERE guild_id = ? AND category = ?`, [newName, interaction.guild.id, oldName], () => resolve()));
            if (changes > 0) {
              try { await renameCategoryRole(interaction.guild, oldName, newName); } catch {}
              await handleCategoryRenamed(interaction.guild, oldName, newName);
            }
            return interaction.reply({ content: changes ? `✅ Renamed category '${oldName}' → '${newName}'.` : `ℹ️ No rows changed. Ensure the old category exists.`, ephemeral: true });
          }

          if (action === 'add_item') {
            const item = interaction.fields.getTextInputValue('item').trim();
            const price = interaction.fields.getTextInputValue('price').trim();
            await priceMgr.addItem(category, item, price);
            return interaction.reply({ content: `✅ Added '${item}' to '${category}' with price '${price}'.`, ephemeral: true });
          }

          if (action === 'rename_item') {
            const oldItem = interaction.fields.getTextInputValue('old').trim();
            const newItem = interaction.fields.getTextInputValue('new').trim();
            const ok = await priceMgr.renameItem(category, oldItem, newItem);
            return interaction.reply({ content: ok ? `✅ Renamed item '${oldItem}' → '${newItem}' in '${category}'.` : `ℹ️ Item not found in '${category}'.`, ephemeral: true });
          }

          if (action === 'remove_item') {
            const item = interaction.fields.getTextInputValue('item').trim();
            const ok = await priceMgr.removeItem(category, item);
            return interaction.reply({ content: ok ? `✅ Removed item '${item}' from '${category}'.` : `ℹ️ Item not found in '${category}'.`, ephemeral: true });
          }

          if (action === 'set_price') {
            const item = interaction.fields.getTextInputValue('item').trim();
            const price = interaction.fields.getTextInputValue('price').trim();
            await priceMgr.setPrice(category, item, price);
            return interaction.reply({ content: `✅ Set price for '${item}' in '${category}' to '${price}'.`, ephemeral: true });
          }

          if (action === 'set_status') {
            let status = interaction.fields.getTextInputValue('status').trim().toLowerCase();
            if (!['open', 'delayed', 'closed'].includes(status)) {
              return interaction.reply({ content: "Status must be one of: open, delayed, closed.", ephemeral: true });
            }
            await setCategoryStatus(interaction.guild.id, category, status);
            await refreshServicesBoard(interaction.guild);
            return interaction.reply({ content: `✅ Set status for '${category}' to '${status}'.`, ephemeral: true });
          }

          return interaction.reply({ content: 'Unknown action.', ephemeral: true });
        } catch (e) {
          console.error('setorderinfo modal error:', e);
          try { return interaction.reply({ content: '❌ Error processing request.', ephemeral: true }); } catch {}
          return;
        }
      }

      if (interaction.customId.startsWith('ticket_open_modal:')) {
        try { await (require('../utils/stats').track)('ticket_open', 1, interaction.guild?.id); } catch {}

        // order tickets

        if (!interaction.deferred && !interaction.replied) {
          try { await interaction.deferReply({ flags: 64 }); } catch {}
        }

        const category = interaction.customId.split(':')[1];
        const roblox = interaction.fields.getTextInputValue('roblox');
        const details = interaction.fields.getTextInputValue('details');
        const deadline = interaction.fields.getTextInputValue('deadline');

        // Create ticket channel
        const ch = await createTicketChannel(interaction.guild, interaction.user, category);
        const role = interaction.guild.roles.cache.find(r => r.name === category);
        const welcome = buildWelcomeEmbed(interaction.user, category);
        const info = buildUserInfoEmbed(interaction.member || interaction.user);
        const form = buildFormEmbed({ roblox, details, deadline });
        const buttons = buildTicketButtons(ch.id);

        await ch.send({ content: `${interaction.user} ${role ? role : ''}`, embeds: [welcome, info, form], components: [buttons] });
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `✅ Ticket created: ${ch}` });
        } else {
          await interaction.reply({ content: `✅ Ticket created: ${ch}`, flags: 64 });
        }
        return;
      }
      if (interaction.customId.startsWith('support_open_modal:')) {
        try { await (require('../utils/stats').track)('ticket_open', 1, interaction.guild?.id); } catch {}

        if (!interaction.deferred && !interaction.replied) {
          try { await interaction.deferReply({ flags: 64 }); } catch {}
        }
        const category = interaction.customId.split(':')[1]; // General Support | HR Support
        const roblox = interaction.fields.getTextInputValue('roblox');
        const reason = interaction.fields.getTextInputValue('reason');

        // Ensure General Support / HR Support channels exist under Support category
        const { resolveSupportCategory, createTicketChannelWithParent } = require('../utils/ticketUtils');
        const supportCat = await resolveSupportCategory(interaction.guild) || await interaction.guild.channels.create({ name: 'Support', type: 4, reason: 'Create Support category' });
        const parentId = supportCat?.id;
        // Ensure roles and create ticket channel under Support
        const { ensureSupportRoles } = require('../utils/categoryRoleSync');
        try { await ensureSupportRoles(interaction.guild); } catch {}
        const ch = await createTicketChannelWithParent(interaction.guild, interaction.user, category, parentId);
        const role = interaction.guild.roles.cache.find(r => r.name === category);
        const welcome = new (require('discord.js').EmbedBuilder)().setTitle(`Support — ${category}`).setColor(BRAND_COLOR_HEX);
        const info = new (require('discord.js').EmbedBuilder)().setTitle('User Information').setColor(BRAND_COLOR_HEX).addFields({ name: 'Roblox Username', value: roblox });
        const form = new (require('discord.js').EmbedBuilder)().setTitle('Support Details').setColor(BRAND_COLOR_HEX).addFields({ name: 'Reason', value: reason });
        const buttons = buildTicketButtons(ch.id);
        await ch.send({ content: `${interaction.user} ${role ? role : ''}`, embeds: [welcome, info, form], components: [buttons] });
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `✅ Support ticket created: ${ch}` });
        } else {
          await interaction.reply({ content: `✅ Support ticket created: ${ch}`, flags: 64 });
        }
        return;
      }

      if (interaction.customId.startsWith('payout_deny_modal:')) {
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const reason = interaction.fields.getTextInputValue('reason');
        const { decidePayout, getPayoutById } = require('../utils/payoutManager');
        await decidePayout(Number(payoutId), 'DENIED', interaction.user.id, reason);
        const payout = await getPayoutById(Number(payoutId));
        try {
          const user = await interaction.client.users.fetch(requesterId).catch(()=>null);
          if (user) {
            const { EmbedBuilder } = require('discord.js');
            const dm = new EmbedBuilder()
              .setTitle('Payout Denied')
              .setDescription('Your payout request was denied. If you think this was unjustified, please open an HR support ticket.')
              .addFields(
                { name: 'Orders', value: String(payout.order_count), inline: true },
                { name: 'Requested (Robux)', value: String(payout.payout_amount), inline: true },
                { name: 'Reason', value: reason },
              )
              .setFooter({ text: `Denied by ${interaction.user.tag}` });
            await user.send({ embeds: [dm] }).catch(()=>{});
          }
        } catch {}
        // Log
        try {
          const logCh = interaction.client.channels.cache.get('1458207384982786282');
          if (logCh && logCh.isTextBased()) {
            const { EmbedBuilder } = require('discord.js');
            const e = new EmbedBuilder()
              .setTitle('Designer Payout Denied')
              .addFields(
                { name: 'Designer', value: `<@${payout.designer_id}>`, inline: true },
                { name: 'Orders', value: String(payout.order_count), inline: true },
                { name: 'Amount (Robux)', value: String(payout.payout_amount), inline: true },
                { name: 'Denied By', value: `${interaction.user}`, inline: true },
                { name: 'Reason', value: reason },
              )
              .setTimestamp(new Date());
            await logCh.send({ embeds: [e] });
          }
        } catch {}
        return interaction.reply({ content: '✅ Denied and user notified.', flags: 64 });
      }

      if (interaction.customId.startsWith('ticket_close_modal:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const reason = interaction.fields.getTextInputValue('reason');
        const meta = await getTicketMeta(interaction.channel);
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason });
      }
    }

    // Catch-all handler for buttons created in embed dashboard
    if (interaction.isButton()) {
      // If we reach here, the button wasn't handled by any specific handler above
      const customId = interaction.customId;
      
      // Smart action parser - supports multiple patterns
      // Format: "reply:Your message here" or "template:template_id" or "em:send_template:id"
      
      // Pattern 1: reply:message - Reply with a custom message
      if (customId.startsWith('reply:')) {
        const message = customId.substring(6); // Remove "reply:" prefix
        return interaction.reply({ content: message || 'No message configured', flags: 64 });
      }
      
      // Pattern 2: template:id - Send a saved template
      if (customId.startsWith('template:')) {
        const templateId = customId.substring(9); // Remove "template:" prefix
        try {
          const { getTemplate } = require('../utils/embedStore');
          const row = await getTemplate(templateId);
          if (!row || !row.data) {
            return interaction.reply({ content: `❌ Template "${templateId}" not found.`, flags: 64 });
          }
          const data = row.data;
          const embeds = [];
          if (data.embed && (data.embed.title||data.embed.description||data.embed.imageURL||data.embed.thumbnailURL)) {
            const { EmbedBuilder } = require('discord.js');
            const e = new EmbedBuilder();
            if(data.embed.title) e.setTitle(String(data.embed.title).slice(0,256));
            if(data.embed.description) e.setDescription(String(data.embed.description).slice(0,4096));
            if(data.embed.color){ const m=String(data.embed.color).match(/^#?([0-9a-fA-F]{6})$/); if(m) e.setColor(parseInt(m[1],16)); }
            if(data.embed.author && (data.embed.author.name||data.embed.author.iconURL)) e.setAuthor({ name: String(data.embed.author.name||'').slice(0,256), iconURL: data.embed.author.iconURL||undefined });
            if(data.embed.thumbnailURL) e.setThumbnail(data.embed.thumbnailURL);
            if(data.embed.imageURL) e.setImage(data.embed.imageURL);
            if(data.embed.footer && (data.embed.footer.text||data.embed.footer.iconURL)) e.setFooter({ text: String(data.embed.footer.text||'').slice(0,2048), iconURL: data.embed.footer.iconURL||undefined });
            if(data.embed.timestamp) e.setTimestamp(new Date());
            embeds.push(e);
          }
          await interaction.channel.send({ content: (data.content||'').slice(0,2000), embeds });
          return interaction.reply({ content: '✅ Template sent!', flags: 64 });
        } catch (e) {
          console.error('Template send error:', e);
          return interaction.reply({ content: '❌ Failed to send template.', flags: 64 });
        }
      }
      
      // Default: Just show the button was clicked
      return interaction.reply({ 
        content: `✅ Button clicked!\n**Custom ID:** \`${customId}\`\n**Label:** ${interaction.component.label || 'N/A'}`, 
        flags: 64 
      });
    }

    // Catch-all handler for select menus created in embed dashboard
    if (interaction.isStringSelectMenu()) {
      // If we reach here, the select menu wasn't handled by any specific handler above
      const customId = interaction.customId;
      const selected = interaction.values[0];
      
      // Smart action parser for select menus
      // The selected value can contain actions: "reply:message" or "template:id"
      
      // Pattern 1: reply:message - Reply with a custom message
      if (selected.startsWith('reply:')) {
        const message = selected.substring(6);
        return interaction.reply({ content: message || 'No message configured', flags: 64 });
      }
      
      // Pattern 2: template:id - Send a saved template
      if (selected.startsWith('template:')) {
        const templateId = selected.substring(9);
        try {
          const { getTemplate } = require('../utils/embedStore');
          const row = await getTemplate(templateId);
          if (!row || !row.data) {
            return interaction.reply({ content: `❌ Template "${templateId}" not found.`, flags: 64 });
          }
          const data = row.data;
          const embeds = [];
          if (data.embed && (data.embed.title||data.embed.description||data.embed.imageURL||data.embed.thumbnailURL)) {
            const { EmbedBuilder } = require('discord.js');
            const e = new EmbedBuilder();
            if(data.embed.title) e.setTitle(String(data.embed.title).slice(0,256));
            if(data.embed.description) e.setDescription(String(data.embed.description).slice(0,4096));
            if(data.embed.color){ const m=String(data.embed.color).match(/^#?([0-9a-fA-F]{6})$/); if(m) e.setColor(parseInt(m[1],16)); }
            if(data.embed.author && (data.embed.author.name||data.embed.author.iconURL)) e.setAuthor({ name: String(data.embed.author.name||'').slice(0,256), iconURL: data.embed.author.iconURL||undefined });
            if(data.embed.thumbnailURL) e.setThumbnail(data.embed.thumbnailURL);
            if(data.embed.imageURL) e.setImage(data.embed.imageURL);
            if(data.embed.footer && (data.embed.footer.text||data.embed.footer.iconURL)) e.setFooter({ text: String(data.embed.footer.text||'').slice(0,2048), iconURL: data.embed.footer.iconURL||undefined });
            if(data.embed.timestamp) e.setTimestamp(new Date());
            embeds.push(e);
          }
          await interaction.channel.send({ content: (data.content||'').slice(0,2000), embeds });
          return interaction.reply({ content: '✅ Template sent!', flags: 64 });
        } catch (e) {
          console.error('Template send error:', e);
          return interaction.reply({ content: '❌ Failed to send template.', flags: 64 });
        }
      }
      
      // Default: Show what was selected
      return interaction.reply({ 
        content: `✅ Option selected!\n**Custom ID:** \`${customId}\`\n**Selected Value:** \`${selected}\``, 
        flags: 64 
      });
    }
  },
};
