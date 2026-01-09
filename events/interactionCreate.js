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
        
        // Log command usage to audit logs
        try {
          const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp } = require('../utils/auditLogger');
          
          const options = interaction.options.data.map(opt => {
            let value = opt.value;
            if (opt.type === 6) value = `<@${opt.value}>`; // User
            if (opt.type === 7) value = `<#${opt.value}>`; // Channel
            if (opt.type === 8) value = `<@&${opt.value}>`; // Role
            return `${opt.name}: ${value}`;
          }).join(', ') || 'None';
          
          const embed = createBaseEmbed({
            title: 'Command Used',
            emoji: '⚙️',
            color: LogColors.INFO,
          });
          
          embed.addFields(
            { name: '👤 User', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: '📍 Channel', value: `<#${interaction.channel.id}>`, inline: true },
            { name: '⚙️ Command', value: `\`/${interaction.commandName}\``, inline: true },
            { name: '📝 Options', value: options, inline: false },
            { name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false }
          );
          
          embed.setFooter({ text: `User ID: ${interaction.user.id}` });
          
          if (interaction.user.avatarURL()) {
            embed.setThumbnail(interaction.user.avatarURL());
          }
          
          await sendAuditLog(interaction.guild, {
            category: LogCategories.COMMANDS,
            embed,
          });
        } catch (logError) {
          // Silently fail if logging fails
          console.error('Failed to log command:', logError);
        }
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
        
        if (choice === 'shop') {
          // Shop Setup
          await interaction.deferReply({ flags: 64 });
          const SHOP_CHANNEL_ID = '1458589011978223727';
          const shopChannel = interaction.guild.channels.cache.get(SHOP_CHANNEL_ID);
          
          if (!shopChannel || !shopChannel.isTextBased()) {
            return interaction.editReply({ content: '❌ Shop channel not found or is not a text channel.' });
          }
          
          const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
          const { BRAND_COLOR_HEX } = require('../utils/branding');
          
          // Create shop embeds
          const bannerEmbed = new EmbedBuilder()
            .setColor(BRAND_COLOR_HEX)
            .setImage('https://message.style/cdn/images/0d448c93c305da833e3e5d43b43ae5df564397b5b6cd725073d2252f7b1151c4.png');
          
          const mainEmbed = new EmbedBuilder()
            .setTitle('Welcome to the KC Shop!')
            .setDescription('Explore the items we offer to help you enjoy your stay. Take a look around, and feel free to ask if you have any questions! Open an HR ticket if you\'d like to claim an item.')
            .setColor(BRAND_COLOR_HEX)
            .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');
          
          const shopSelect = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder('Buy an item!')
            .addOptions([
              { label: 'Giveaways & Advertisements', value: 'giveaways', description: 'Promote your community in ours!' },
              { label: 'Premium', value: 'premium', description: 'Get items, discounts, and more!' },
              { label: 'Donations', value: 'donations', description: 'Help out our server for a small perk!' },
            ]);
          
          const row = new ActionRowBuilder().addComponents(shopSelect);
          
          try {
            await shopChannel.send({ embeds: [bannerEmbed, mainEmbed], components: [row] });
            return interaction.editReply({ content: `✅ Shop has been set up in ${shopChannel}!` });
          } catch (e) {
            console.error('Shop setup error:', e);
            return interaction.editReply({ content: '❌ Failed to send shop message. Check bot permissions.' });
          }
        }
        
        if (choice === 'services') {
          // Services Setup - Send services board to channel
          await interaction.deferReply({ flags: 64 });
          const SERVICES_CHANNEL_ID = '1457494227566067895';
          const servicesChannel = interaction.guild.channels.cache.get(SERVICES_CHANNEL_ID);
          
          if (!servicesChannel || !servicesChannel.isTextBased()) {
            return interaction.editReply({ content: '❌ Services channel not found or is not a text channel.' });
          }
          
          try {
            const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
            const { BRAND_COLOR_HEX } = require('../utils/branding');
            const { buildFields } = require('../utils/servicesBoard');
            const { listCategories, seedDefaultsIfEmpty } = require('../utils/priceManager');
            
            await seedDefaultsIfEmpty();
            const fields = await buildFields(interaction.guild, null);
            
            const bannerEmbed = new EmbedBuilder()
              .setColor(BRAND_COLOR_HEX)
              .setImage('https://message.style/cdn/images/73c03054d041546292863ab6737c04d00e26b01bb9feb653a58b1ba7e37238c1.png');
            
            const contentEmbed = new EmbedBuilder()
              .setTitle("Welcome to King's Customs")
              .setColor(BRAND_COLOR_HEX)
              .setDescription("Let's make a fun and enjoyable experience for you. First off, while ordering an item, please be sure to acknowledge the rules and order information.")
              .addFields(fields)
              .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');
            
            // Build dropdowns
            const infoSelect = new StringSelectMenuBuilder()
              .setCustomId('rd_order_info')
              .setPlaceholder('Order Information')
              .addOptions([{ label: 'View Order Information', value: 'view', description: 'See pricing and details' }]);
            
            const cats = await listCategories();
            const orderOptions = cats.map(c => ({ label: c, value: c, description: `Order ${c}` }));
            const orderSelect = new StringSelectMenuBuilder()
              .setCustomId('rd_ticket_select')
              .setPlaceholder("Start a King's Customs order")
              .addOptions(orderOptions.length ? orderOptions : [{ label: 'No categories', value: 'none', description: 'No categories available' }]);
            
            const row1 = new ActionRowBuilder().addComponents(infoSelect);
            const row2 = new ActionRowBuilder().addComponents(orderSelect);
            
            await servicesChannel.send({ embeds: [bannerEmbed, contentEmbed], components: [row1, row2] });
            return interaction.editReply({ content: `✅ Services board has been set up in ${servicesChannel}!` });
          } catch (e) {
            console.error('Services setup error:', e);
            return interaction.editReply({ content: '❌ Failed to send services board. Check bot permissions.' });
          }
        }
        
        if (choice === 'support') {
          // Support Setup - Send support panel to channel
          await interaction.deferReply({ flags: 64 });
          const SUPPORT_CHANNEL_ID = '1457922312782479423';
          const supportChannel = interaction.guild.channels.cache.get(SUPPORT_CHANNEL_ID);
          
          if (!supportChannel || !supportChannel.isTextBased()) {
            return interaction.editReply({ content: '❌ Support channel not found or is not a text channel.' });
          }
          
          try {
            const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
            
            const bannerEmbed = new EmbedBuilder()
              .setColor(0x2E7EFE)
              .setImage('https://message.style/cdn/images/d4f916eb6818e8c9ebd3197ceaa327ea1c142f11f45cdc98e3c53088b6c4b3c1.png');
            
            const supportEmbed = new EmbedBuilder()
              .setTitle('Welcome to Support!')
              .setDescription('If you\'re experiencing issues or need assistance, please open a ticket so our team can assist you.')
              .setColor(0x2E7EFE)
              .addFields([
                {
                  name: 'General Support:',
                  value: '> - Reporting bugs or issues\n> - Technical Help\n> - General Inquiries',
                  inline: true
                },
                {
                  name: 'HR Support:',
                  value: '> - Applying for roles\n> - Appeals\n> - Partnerships\n> - Advanced Inquiries',
                  inline: true
                }
              ])
              .setFooter({ 
                text: 'Thank you for choosing Kings Customs',
                iconURL: 'https://cdn.discordapp.com/attachments/1344821240564682856/1457891305224015972/WhiteOutlined.png?ex=696243d5&is=6960f255&hm=6ca3e10b66d521155ed9b5a697ea3b2a10f45fd53fd3c37eb5ed18157d799bf0&animated=true&'
              })
              .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');
            
            const supportSelect = new StringSelectMenuBuilder()
              .setCustomId('support_select')
              .setPlaceholder('Select a support category')
              .addOptions([
                { label: 'General Support', value: 'General Support', description: 'Bugs, technical help, general inquiries' },
                { label: 'HR Support', value: 'HR Support', description: 'Roles, appeals, partnerships, advanced inquiries' },
              ]);
            
            const row = new ActionRowBuilder().addComponents(supportSelect);
            
            await supportChannel.send({ embeds: [bannerEmbed, supportEmbed], components: [row] });
            return interaction.editReply({ content: `✅ Support panel has been set up in ${supportChannel}!` });
          } catch (e) {
            console.error('Support setup error:', e);
            return interaction.editReply({ content: '❌ Failed to send support panel. Check bot permissions.' });
          }
        }
        
        if (choice === 'orders') {
          // Orders Setup - Just configure/seed defaults
          await interaction.deferReply({ flags: 64 });
          try {
            const { seedDefaultsIfEmpty } = require('../utils/priceManager');
            await seedDefaultsIfEmpty();
            return interaction.editReply({ content: '✅ Order categories have been configured! Use `/setorderinfo` to manage prices and statuses.' });
          } catch (e) {
            console.error('Orders setup error:', e);
            return interaction.editReply({ content: '❌ Failed to configure order categories.' });
          }
        }
        
        return interaction.reply({ 
          content: '❌ Unknown setup option selected.', 
          flags: 64 
        });
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
          // Check verified role for order tickets
          const VERIFIED_ROLE_ID = '1297874929085317150';
          if (!interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
            return interaction.reply({ content: '❌ You must be verified to open order tickets. Please verify your account first.', flags: 64 });
          }

          // Check blacklist for order tickets
          const { isBlacklisted } = require('../utils/ticketBlacklist');
          const blocked = await isBlacklisted(interaction.user.id, 'order').catch(()=>false);
          if (blocked) {
            return interaction.reply({ content: '❌ You are blacklisted from opening order tickets.', flags: 64 });
          }

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
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason for the ticket').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        );
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'shop_select') {
        const selection = interaction.values[0]; // 'giveaways' | 'premium' | 'donations'
        
        let bannerUrl = '';
        let title = '';
        let description = '';
        
        if (selection === 'giveaways') {
          bannerUrl = 'https://message.style/cdn/images/0d448c93c305da833e3e5d43b43ae5df564397b5b6cd725073d2252f7b1151c4.png';
          title = 'Giveaways & Ads';
          description = 'When you buy a sponsored giveaway, you must pay for the ping type and cover the prize cost, including tax. We will send the prize to the winner.\n\nWhen you buy an advertisement, your ad will be posted in the affiliates section after payment is made.\n\n[Sponsored Giveaway (everyone ping)](https://www.roblox.com/game-pass/1665968459/Sponsored-Giveaway-Everyone-Ping)\n[Sponsored Giveaway (here ping)](https://www.roblox.com/game-pass/1665824605/Sponsored-Giveaway-here-ping)\n[Advertisement (everyone ping)](https://www.roblox.com/game-pass/1664586016/Advertisement-everyone-ping)\n[Advertisement (here ping)](https://www.roblox.com/game-pass/1665926341/Advertisement-here-ping)';
        } else if (selection === 'premium') {
          bannerUrl = 'https://message.style/cdn/images/9dd089e014d40f38c685904529e2d52bf326be08cd72d8fcb2f19a74269d83de.png';
          title = 'Premium';
          description = 'If you buy the Premium pass, you\'ll get a VIP role, 10% off all orders, $100,000 in economy money, early access to free releases, and free priority on orders.\n\n[Premium Gamepass](https://www.roblox.com/game-pass/1665854574/Premium)';
        } else if (selection === 'donations') {
          bannerUrl = 'https://message.style/cdn/images/93b3ad9c439c563e702e72cf0bfda520ebf81c5cd0dfe0a7210283340cb43955.png';
          title = 'Donations';
          description = 'If you want to support our server and help it grow, you can donate! Donations include boosting the server or giving Robux. When you donate, you\'ll get 3 weeks of Premium on us. Just ask to donate in https://discord.com/channels/1264368359944749066/1442045952511705139\n\nYou must donate more than 150 Robux to recieve premium.';
        }
        
        const bannerEmbed = new EmbedBuilder()
          .setColor(BRAND_COLOR_HEX)
          .setImage(bannerUrl);
        
        const contentEmbed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(BRAND_COLOR_HEX)
          .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png');
        
        return interaction.reply({ embeds: [bannerEmbed, contentEmbed], flags: 64 });
      }
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('catrole_save:')) {
        return interaction.reply({ content: '❌ Category role mapping is now hardcoded and cannot be changed through this interface.', flags: 64 });
      }

      if (interaction.customId.startsWith('payout_approve:')) {
        await interaction.deferUpdate();
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const { decidePayout, getPayoutById } = require('../utils/payoutManager');
        await decidePayout(Number(payoutId), 'APPROVED', interaction.user.id, null);
        const payout = await getPayoutById(Number(payoutId));
        
        // Send DM to designer
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
              .setColor(0x00FF00) // Green
              .setFooter({ text: `Approved by ${interaction.user.tag}` });
            await user.send({ embeds: [dm] }).catch(()=>{});
          }
        } catch {}
        
        // Edit the original message embed
        const originalEmbed = interaction.message.embeds[0];
        const { EmbedBuilder } = require('discord.js');
        const updatedEmbed = new EmbedBuilder()
          .setTitle('Payment Completed')
          .setColor(0x00FF00) // Green
          .setDescription(`${interaction.user} marked this payout as completed.`)
          .addFields(
            { name: 'Designer', value: `<@${payout.designer_id}>`, inline: true },
            { name: 'Orders', value: String(payout.order_count), inline: true },
            { name: 'Total (Robux)', value: String(payout.total_amount), inline: true },
            { name: 'Payout (Robux)', value: String(payout.payout_amount), inline: true },
            { name: 'Approved By', value: `${interaction.user}`, inline: true },
          )
          .setFooter({ text: `Payout ID: ${payoutId} • Completed at ${new Date().toUTCString()}` });
        
        return interaction.editReply({ embeds: [updatedEmbed], components: [] });
      }

      if (interaction.customId.startsWith('payout_deny:')) {
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder().setCustomId(`payout_deny_modal:${payoutId}:${requesterId}`).setTitle('Deny Payout — Reason');
        modal.addComponents(new (require('discord.js').ActionRowBuilder)().addComponents(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setLabel('Reason').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('log_order:')) {
        // Defer the update to prevent timeout
        await interaction.deferUpdate();
        
        const [, orderId, designerId] = interaction.customId.split(':');
        
        // Check if designerId is a Discord ID or Roblox username
        const isDiscordId = /^\d{17,19}$/.test(designerId);
        
        // If it's a Discord ID, only that user can log
        if (isDiscordId && interaction.user.id !== designerId) {
          return interaction.followUp({ content: 'Only the assigned designer may log this order.', ephemeral: true });
        }
        
        // If it's a Roblox username, check for management permissions
        if (!isDiscordId) {
          const hasPerms = interaction.member.permissions.has('ManageGuild') || 
                          interaction.user.id === interaction.guild.ownerId;
          if (!hasPerms) {
            return interaction.followUp({ content: '❌ You need management permissions to log this order.', ephemeral: true });
          }
        }
        
        try {
          const { getPayment, tryMarkLogged } = require('../utils/paymentManager');
          const payment = await getPayment(orderId);
          if (!payment) return interaction.followUp({ content: 'Order not found.', ephemeral: true });
          
          console.log(`[log_order] Order ${orderId} status: ${payment.status}`);
          
          if (payment.status !== 'CONFIRMED' && payment.status !== 'LOGGED') {
            return interaction.followUp({ content: `❌ Payment not confirmed yet. Current status: ${payment.status}`, ephemeral: true });
          }
          
          // Get ticket ID from current channel if it's a ticket
          let ticketId = null;
          try {
            const meta = await getTicketMeta(interaction.channel);
            ticketId = meta.ticketId || null;
          } catch {}
          
          // Mark as logged (idempotent - won't fail if already logged)
          await tryMarkLogged(orderId, ticketId);
          
          // Use Bloxlink API to find buyer's Discord account and assign role
          const BUYER_ROLE_ID = '1459287123495485551';
          let buyerDiscordId = null;
          let buyerMention = '';
          
          try {
            const { resolveDiscordFromRoblox } = require('../utils/bloxlinkApi');
            console.log(`[log_order] Looking up Discord ID for Roblox user: ${payment.roblox_username}`);
            
            const result = await resolveDiscordFromRoblox(interaction.guild.id, payment.roblox_username);
            console.log(`[log_order] Bloxlink result:`, result);
            
            if (result.discordIds && result.discordIds.length > 0) {
              // Try to assign role to all linked Discord accounts
              for (const discordId of result.discordIds) {
                try {
                  const member = await interaction.guild.members.fetch(discordId);
                  if (member) {
                    await member.roles.add(BUYER_ROLE_ID);
                    console.log(`[log_order] Assigned buyer role to ${discordId}`);
                    
                    // Store first found Discord ID for DM and mention
                    if (!buyerDiscordId) {
                      buyerDiscordId = discordId;
                      buyerMention = ` (<@${discordId}>)`;
                    }
                  }
                } catch (roleErr) {
                  console.error(`[log_order] Failed to assign role to ${discordId}:`, roleErr);
                }
              }
            } else {
              console.log(`[log_order] No Discord accounts found for ${payment.roblox_username}`);
            }
          } catch (bloxlinkErr) {
            console.error('[log_order] Bloxlink API error:', bloxlinkErr);
            // Continue even if Bloxlink fails - don't block order logging
          }
          
          // Hardcoded orders log channel
          const ORDERS_LOG_CHANNEL_ID = '1457531008835522741';
          const logChannel = interaction.client.channels.cache.get(ORDERS_LOG_CHANNEL_ID);
          if (!logChannel || !logChannel.isTextBased()) return interaction.followUp({ content: 'Orders log channel not available.', ephemeral: true });
          const { EmbedBuilder } = require('discord.js');
          
          const logFields = [
            { name: 'Purchaser (Roblox)', value: `${payment.roblox_username}${buyerMention}`, inline: true },
            { name: 'Designer', value: isDiscordId ? `<@${designerId}>` : designerId, inline: true },
            { name: 'Price', value: `${payment.price} Robux`, inline: true }
          ];
          
          if (ticketId) {
            logFields.push({ name: 'Ticket ID', value: `#${ticketId}`, inline: true });
          }
          
          logFields.push({ name: 'Reason', value: payment.reason });
          
          const logEmbed = new EmbedBuilder()
            .setTitle('Order Logged')
            .setColor(BRAND_COLOR_HEX)
            .addFields(logFields)
            .setFooter({ text: `Order ID: ${orderId}` });
          await logChannel.send({ embeds: [logEmbed] });
          
          // Send DM to buyer with order confirmation and review prompt
          if (buyerDiscordId) {
            try {
              const buyer = await interaction.client.users.fetch(buyerDiscordId);
              const dmEmbed = new EmbedBuilder()
                .setTitle('King\'s Customs — Payment Confirmed')
                .setDescription('Your payment has been confirmed and your order has been logged! You should receive your products from your designer shortly.')
                .setColor(BRAND_COLOR_HEX)
                .addFields([
                  { name: 'Order Details', value: payment.reason, inline: false },
                  { name: 'Price', value: `${payment.price} Robux`, inline: true },
                  { name: 'Order ID', value: orderId, inline: true }
                ])
                .addFields([
                  { name: '⭐ Review Your Designer', value: 'After receiving your products, please review your designer using `/review` in <#1411101165671678042>!', inline: false }
                ])
                .setFooter({ text: 'Thank you for your order!' })
                .setTimestamp();
              
              await buyer.send({ embeds: [dmEmbed] });
              console.log(`[log_order] Sent DM to buyer ${buyerDiscordId}`);
            } catch (dmErr) {
              console.error(`[log_order] Failed to send DM to buyer:`, dmErr);
              // Continue even if DM fails - don't block order logging
            }
          }
          
          // Update the original message embed to show order confirmed and logged (green)
          const updatedEmbed = new EmbedBuilder()
            .setTitle(`King's Customs — Order Confirmed and Logged`)
            .setDescription(
              `**Roblox User:** ${payment.roblox_username}\n` +
              `**Reason:** ${payment.reason}\n` +
              `**Price:** ${payment.price} Robux`
            )
            .setFooter({ text: `Order ID: ${orderId}` })
            .setColor(0x00FF00); // Green
          
          // Remove the button by passing empty components array
          await interaction.editReply({ embeds: [updatedEmbed], components: [] });
          
          return interaction.followUp({ content: '✅ Order logged to Orders Log.', ephemeral: true });
        } catch (e) {
          console.error('log_order button error:', e);
          return interaction.followUp({ content: '❌ Failed to log order.', ephemeral: true });
        }
      }
      
      // Ban Appeal: Start appeal process
      if (interaction.customId.startsWith('ban_appeal_start:')) {
        const guildId = interaction.customId.split(':')[1];
        
        // Check cooldown
        const { canUserAppeal } = require('../utils/banAppeals');
        const canAppeal = await canUserAppeal(interaction.user.id, guildId).catch(() => false);
        
        if (!canAppeal) {
          return interaction.reply({ 
            content: '❌ You have already submitted an appeal recently. You must wait 14 days after a denied appeal before submitting another one.', 
            ephemeral: true 
          });
        }
        
        // Show modal
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`ban_appeal_modal:${guildId}`)
          .setTitle('Ban Appeal');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason_for_ban')
          .setLabel('Explain the actions that led to your ban')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe what happened and what you were banned for...')
          .setRequired(true)
          .setMaxLength(1000);
        
        const whyUnbanInput = new TextInputBuilder()
          .setCustomId('why_unban')
          .setLabel('Why do you think you should be unbanned?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explain why you believe you deserve another chance...')
          .setRequired(true)
          .setMaxLength(1000);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(reasonInput),
          new ActionRowBuilder().addComponents(whyUnbanInput)
        );
        
        return interaction.showModal(modal);
      }
      
      // Ban Appeal: Approve
      if (interaction.customId.startsWith('ban_appeal_approve:')) {
        await interaction.deferReply({ ephemeral: true });
        const appealId = interaction.customId.split(':')[1];
        
        const { getBanAppeal, approveBanAppeal } = require('../utils/banAppeals');
        const appeal = await getBanAppeal(appealId);
        
        if (!appeal) {
          return interaction.editReply({ content: '❌ Appeal not found.' });
        }
        
        if (appeal.status !== 'pending') {
          return interaction.editReply({ content: `❌ This appeal has already been ${appeal.status}.` });
        }
        
        // Unban the user
        try {
          const guild = interaction.client.guilds.cache.get(appeal.guild_id);
          if (guild) {
            await guild.bans.remove(appeal.user_id, 'Ban appeal approved');
          }
        } catch (e) {
          console.error('Failed to unban user:', e);
          return interaction.editReply({ content: '❌ Failed to unban user. They may not be banned or I lack permissions.' });
        }
        
        // Update appeal status
        await approveBanAppeal(appealId, interaction.user.id);
        
        // Send DM to user
        try {
          const user = await interaction.client.users.fetch(appeal.user_id);
          const approvalEmbed = new EmbedBuilder()
            .setTitle('✅ Ban Appeal Approved')
            .setDescription('Your ban appeal has been approved! You may now rejoin King\'s Customs.')
            .setColor(0x00FF00)
            .addFields([
              { name: 'Server', value: 'King\'s Customs', inline: true },
              { name: 'Reviewed By', value: `<@${interaction.user.id}>`, inline: true }
            ])
            .setFooter({ text: 'Please follow our rules to avoid future bans' })
            .setTimestamp();
          
          await user.send({ embeds: [approvalEmbed] });
        } catch (e) {
          console.error('Failed to send approval DM:', e);
        }
        
        // Update the original message
        try {
          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x00FF00)
            .setTitle('✅ Ban Appeal - APPROVED')
            .addFields([{ name: 'Reviewed By', value: `<@${interaction.user.id}>`, inline: true }]);
          
          await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
        } catch (e) {
          console.error('Failed to update appeal message:', e);
        }
        
        return interaction.editReply({ content: '✅ Ban appeal approved. User has been unbanned and notified.' });
      }
      
      // Ban Appeal: Deny
      if (interaction.customId.startsWith('ban_appeal_deny:')) {
        await interaction.deferReply({ ephemeral: true });
        const appealId = interaction.customId.split(':')[1];
        
        const { getBanAppeal, denyBanAppeal } = require('../utils/banAppeals');
        const appeal = await getBanAppeal(appealId);
        
        if (!appeal) {
          return interaction.editReply({ content: '❌ Appeal not found.' });
        }
        
        if (appeal.status !== 'pending') {
          return interaction.editReply({ content: `❌ This appeal has already been ${appeal.status}.` });
        }
        
        // Update appeal status with 14 day cooldown
        await denyBanAppeal(appealId, interaction.user.id);
        
        // Send DM to user
        try {
          const user = await interaction.client.users.fetch(appeal.user_id);
          const denialEmbed = new EmbedBuilder()
            .setTitle('❌ Ban Appeal Denied')
            .setDescription('Your ban appeal has been denied. You may submit another appeal in 14 days.')
            .setColor(0xFF0000)
            .addFields([
              { name: 'Server', value: 'King\'s Customs', inline: true },
              { name: 'Reviewed By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Next Appeal Available', value: `<t:${Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000)}:R>`, inline: false }
            ])
            .setFooter({ text: 'Appeals are reviewed carefully by our moderation team' })
            .setTimestamp();
          
          await user.send({ embeds: [denialEmbed] });
        } catch (e) {
          console.error('Failed to send denial DM:', e);
        }
        
        // Update the original message
        try {
          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xFF0000)
            .setTitle('❌ Ban Appeal - DENIED')
            .addFields([{ name: 'Reviewed By', value: `<@${interaction.user.id}>`, inline: true }]);
          
          await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
        } catch (e) {
          console.error('Failed to update appeal message:', e);
        }
        
        return interaction.editReply({ content: '✅ Ban appeal denied. User has been notified and can appeal again in 14 days.' });
      }
      
      // LOA: Request new LOA
      if (interaction.customId === 'loa_request_new') {
        try {
          const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
          const modal = new ModalBuilder()
            .setCustomId('loa_request_modal')
            .setTitle('Request Leave of Absence');
          
          const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (e.g., 1d, 2w, 3h)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Examples: 1d, 2w, 1h, 30m')
            .setRequired(true);
          
          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Why do you need this leave?')
            .setRequired(true);
          
          modal.addComponents(
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );
          
          return interaction.showModal(modal);
        } catch (error) {
          console.error('[LOA] Error showing modal:', error);
          return interaction.reply({ content: '❌ Failed to open modal.', ephemeral: true });
        }
      }
      
      // LOA: Request extension
      if (interaction.customId.startsWith('loa_request_extension:')) {
        const loaId = interaction.customId.split(':')[1];
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`loa_extension_modal:${loaId}`)
          .setTitle('Request LOA Extension');
        
        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Additional Duration (e.g., 1d, 2w, 3h)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Examples: 1d, 2w, 1h, 30m')
          .setRequired(true);
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for Extension')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Why do you need to extend your leave?')
          .setRequired(true);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(durationInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );
        
        return interaction.showModal(modal);
      }
      
      // LOA: End early
      if (interaction.customId.startsWith('loa_end_early:')) {
        await interaction.deferReply({ ephemeral: true });
        const loaId = parseInt(interaction.customId.split(':')[1]);
        
        try {
          const { getLOAById, endLOA, LOA_ROLE_ID, LOA_LOGS_CHANNEL_ID, formatDuration } = require('../utils/loaManager');
          const loa = await getLOAById(loaId);
          
          if (!loa) {
            return interaction.editReply({ content: '❌ LOA not found.' });
          }
          
          if (loa.user_id !== interaction.user.id) {
            return interaction.editReply({ content: '❌ This is not your LOA.' });
          }
          
          if (loa.status !== 'ACTIVE') {
            return interaction.editReply({ content: '❌ This LOA is not active.' });
          }
          
          // End the LOA
          await endLOA(loaId, true);
          
          // Remove LOA role
          try {
            await interaction.member.roles.remove(LOA_ROLE_ID);
          } catch (e) {
            console.error('Failed to remove LOA role:', e);
          }
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const { EmbedBuilder } = require('discord.js');
              const { BRAND_NAME } = require('../utils/branding');
              const startTime = new Date(loa.start_time);
              const originalEndTime = new Date(loa.end_time);
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Ended Early`)
                .setColor(0xFFA500)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Ended By', value: `<@${interaction.user.id}> (Self)`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Started', value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
                  { name: 'Was Scheduled to End', value: `<t:${Math.floor(originalEndTime.getTime() / 1000)}:R>`, inline: true },
                  { name: 'Original Duration', value: formatDuration(loa.duration_ms), inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM
          try {
            const { EmbedBuilder } = require('discord.js');
            const { BRAND_NAME } = require('../utils/branding');
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Ended Early`)
              .setDescription('You have ended your leave of absence early.')
              .setColor(0xFFA500)
              .addFields(
                { name: 'LOA ID', value: String(loaId), inline: true },
                { name: 'Ended At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
              )
              .setFooter({ text: BRAND_NAME });
            
            await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          await interaction.editReply({ content: '✅ Your leave has been ended early. You are now back on duty.' });
        } catch (error) {
          console.error('Error ending LOA early:', error);
          await interaction.editReply({ content: '❌ Failed to end LOA. Please contact an administrator.' });
        }
      }
      
      // LOA: Proceed anyway (after payout warning)
      if (interaction.customId.startsWith('loa_proceed_anyway:')) {
        await interaction.deferUpdate();
        const [, durationMsStr, timestampStr] = interaction.customId.split(':');
        const durationMs = parseInt(durationMsStr);
        
        // Show the modal again to get the reason
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`loa_request_modal_proceed:${durationMs}`)
          .setTitle('Request Leave of Absence');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Why do you need this leave?')
          .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        
        return interaction.showModal(modal);
      }
      
      // LOA: Cancel request
      if (interaction.customId === 'loa_cancel_request') {
        await interaction.deferUpdate();
        return interaction.editReply({ content: '❌ LOA request cancelled.', embeds: [], components: [] });
      }
      
      // LOA: Approve request
      if (interaction.customId.startsWith('loa_approve:')) {
        await interaction.deferUpdate();
        const loaId = parseInt(interaction.customId.split(':')[1]);
        
        try {
          const { getLOAById, approveLOA, LOA_ROLE_ID, LOA_LOGS_CHANNEL_ID, formatDuration } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME, BRAND_COLOR_HEX } = require('../utils/branding');
          
          const loa = await getLOAById(loaId);
          if (!loa) {
            return interaction.followUp({ content: '❌ LOA not found.', ephemeral: true });
          }
          
          // Approve the LOA
          await approveLOA(loaId, interaction.user.id);
          
          // Assign LOA role
          try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(loa.user_id);
            await member.roles.add(LOA_ROLE_ID);
          } catch (e) {
            console.error('Failed to assign LOA role:', e);
          }
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const endTime = new Date(Date.now() + loa.duration_ms);
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA ${loa.is_extension ? 'Extension ' : ''}Approved`)
                .setColor(0x00FF00)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Approved By', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Duration', value: formatDuration(loa.duration_ms), inline: true },
                  { name: 'Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to requester
          try {
            const user = await interaction.client.users.fetch(loa.user_id);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Approved`)
              .setDescription('Your leave of absence request has been approved!')
              .setColor(0x00FF00)
              .addFields(
                { name: 'Duration', value: formatDuration(loa.duration_ms), inline: true },
                { name: 'Ends', value: `<t:${Math.floor((Date.now() + loa.duration_ms) / 1000)}:R>`, inline: true },
                { name: 'Reason', value: loa.reason }
              )
              .setFooter({ text: `Approved by ${interaction.user.tag}` });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          // Update the request embed
          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle(`${BRAND_NAME} — LOA Request ${loa.is_extension ? '(Extension) ' : ''}— APPROVED`)
            .setColor(0x00FF00)
            .addFields({ name: 'Approved By', value: `<@${interaction.user.id}>`, inline: true });
          
          await interaction.editReply({ embeds: [updatedEmbed], components: [] });
        } catch (error) {
          console.error('Error approving LOA:', error);
          await interaction.followUp({ content: '❌ Failed to approve LOA.', ephemeral: true });
        }
      }
      
      // LOA Admin: Start LOA
      if (interaction.customId === 'loa_admin_start' || interaction.customId.startsWith('loa_admin_start:')) {
        const prefilledUserId = interaction.customId.includes(':') ? interaction.customId.split(':')[1] : '';
        
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('loa_admin_start_modal')
          .setTitle('Start LOA (Admin)');
        
        const userInput = new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('User ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Discord User ID')
          .setValue(prefilledUserId)
          .setRequired(true);
        
        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duration (e.g., 1d, 2w, 3h)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Examples: 1d, 2w, 1h, 30m')
          .setRequired(true);
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(userInput),
          new ActionRowBuilder().addComponents(durationInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );
        
        return interaction.showModal(modal);
      }
      
      // LOA Admin: End LOA
      if (interaction.customId === 'loa_admin_end') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('loa_admin_end_modal')
          .setTitle('End LOA (Admin)');
        
        const loaIdInput = new TextInputBuilder()
          .setCustomId('loa_id')
          .setLabel('LOA ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter LOA ID number')
          .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(loaIdInput));
        
        return interaction.showModal(modal);
      }
      
      // LOA Admin: Extend LOA
      if (interaction.customId === 'loa_admin_extend') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('loa_admin_extend_modal')
          .setTitle('Extend LOA (Admin)');
        
        const loaIdInput = new TextInputBuilder()
          .setCustomId('loa_id')
          .setLabel('LOA ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter LOA ID number')
          .setRequired(true);
        
        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Additional Duration (e.g., 1d, 2w)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Examples: 1d, 2w, 3h')
          .setRequired(true);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(loaIdInput),
          new ActionRowBuilder().addComponents(durationInput)
        );
        
        return interaction.showModal(modal);
      }
      
      // LOA Admin: Edit Reason
      if (interaction.customId === 'loa_admin_edit') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('loa_admin_edit_modal')
          .setTitle('Edit LOA Reason (Admin)');
        
        const loaIdInput = new TextInputBuilder()
          .setCustomId('loa_id')
          .setLabel('LOA ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter LOA ID number')
          .setRequired(true);
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('New Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(loaIdInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );
        
        return interaction.showModal(modal);
      }
      
      // LOA: Deny request
      if (interaction.customId.startsWith('loa_deny:')) {
        await interaction.deferUpdate();
        const loaId = parseInt(interaction.customId.split(':')[1]);
        
        try {
          const { getLOAById, denyLOA, LOA_LOGS_CHANNEL_ID, formatDuration } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME } = require('../utils/branding');
          
          const loa = await getLOAById(loaId);
          if (!loa) {
            return interaction.followUp({ content: '❌ LOA not found.', ephemeral: true });
          }
          
          // Deny the LOA
          await denyLOA(loaId, interaction.user.id);
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA ${loa.is_extension ? 'Extension ' : ''}Denied`)
                .setColor(0xFF0000)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Denied By', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Requested Duration', value: formatDuration(loa.duration_ms), inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to requester
          try {
            const user = await interaction.client.users.fetch(loa.user_id);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Denied`)
              .setDescription('Your leave of absence request has been denied. If you have questions, please open an HR support ticket.')
              .setColor(0xFF0000)
              .addFields(
                { name: 'Duration', value: formatDuration(loa.duration_ms), inline: true },
                { name: 'Reason', value: loa.reason }
              )
              .setFooter({ text: `Denied by ${interaction.user.tag}` });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          // Update the request embed
          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle(`${BRAND_NAME} — LOA Request ${loa.is_extension ? '(Extension) ' : ''}— DENIED`)
            .setColor(0xFF0000)
            .addFields({ name: 'Denied By', value: `<@${interaction.user.id}>`, inline: true });
          
          await interaction.editReply({ embeds: [updatedEmbed], components: [] });
        } catch (error) {
          console.error('Error denying LOA:', error);
          await interaction.followUp({ content: '❌ Failed to deny LOA.', ephemeral: true });
        }
      }
    }

    // Role select menus
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId.startsWith('catrole_role:')) {
        return interaction.reply({ content: '❌ Category role mapping is now hardcoded and cannot be changed through this interface.', flags: 64 });
      }
      return;
    }

    // Back to string select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('catrole_select:')) {
        return interaction.reply({ content: '❌ Category role mapping is now hardcoded and cannot be changed through this interface.', flags: 64 });
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
          return interaction.reply({ content: 'ℹ️ Role auto-sync has been disabled. Role mappings are hardcoded.', flags: 64 });
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
        return interaction.update({ content: 'Cancelled.', embeds: [], components: [] });
      }
      if (interaction.customId.startsWith('ticket_claim:')) {
        try {
          const channelId = interaction.customId.split(':')[1];
          if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
          
          const meta = await getTicketMeta(interaction.channel);
          
          // Check if already claimed
          if (meta.claimedBy) {
            return interaction.reply({ content: `❌ This ticket is already claimed by <@${meta.claimedBy}>.`, ephemeral: true });
          }
          
          meta.claimedBy = interaction.user.id;
          try { await interaction.channel.setTopic(JSON.stringify(meta)); } catch {}
          
          // Update the message to remove the claim button
          const newButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_close:${channelId}`).setLabel('Close').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`ticket_close_reason:${channelId}`).setLabel('Close w/ Reason').setStyle(ButtonStyle.Danger),
          );
          
          // Update the original message and send response
          await interaction.update({ components: [newButtons] });
          
          // Send a follow-up message
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_COLOR_HEX, BRAND_NAME } = require('../utils/branding');
          const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${interaction.user}.`)
            .setColor(BRAND_COLOR_HEX)
            .addFields(
              { name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Claimed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: BRAND_NAME })
            .setTimestamp();
          
          return interaction.followUp({ embeds: [embed] });
        } catch (error) {
          console.error('Error in ticket_claim:', error);
          try {
            if (!interaction.replied && !interaction.deferred) {
              return interaction.reply({ content: '❌ Failed to claim ticket.', ephemeral: true });
            }
          } catch {}
        }
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
        await interaction.deferReply({ ephemeral: true });
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.editReply({ content: 'Use this in the ticket channel.' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_close_confirm:${channelId}`).setLabel('Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Nevermind').setStyle(ButtonStyle.Secondary),
        );
        const embed = new EmbedBuilder().setTitle('Confirm Close').setDescription('Are you sure you want to close this ticket?').setColor(0xFFAA00);
        return interaction.editReply({ embeds: [embed], components: [row] });
      }
      if (interaction.customId.startsWith('ticket_close_confirm:')) {
        await interaction.deferReply({ ephemeral: true });
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.editReply({ content: 'Use this in the ticket channel.' });
        const meta = await getTicketMeta(interaction.channel);
        await interaction.editReply({ content: '✅ Closing ticket...' });
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason: null, ticketId: meta.ticketId });
      }
      if (interaction.customId === 'ticket_close_cancel') {
        return interaction.update({ content: 'Close cancelled.', embeds: [], components: [] });
      }
      if (interaction.customId.startsWith('close_req_confirm:')) {
        await interaction.deferReply({ ephemeral: true });
        const [, chId] = interaction.customId.split(':');
        if (interaction.channel.id !== chId) return interaction.editReply({ content: 'Use this in the ticket channel.' });
        const meta = await getTicketMeta(interaction.channel);
        await interaction.editReply({ content: '✅ Closing ticket...' });
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason: 'Closed by request', ticketId: meta.ticketId });
      }
      if (interaction.customId.startsWith('close_req_keep:')) {
        await interaction.deferUpdate();
        const [, chId] = interaction.customId.split(':');
        if (interaction.channel.id !== chId) return interaction.editReply({ content: 'Use this in the ticket channel.' });
        const { clearChannelTimer } = require('../utils/ticketTimers');
        clearChannelTimer(chId);
        return interaction.editReply({ content: 'Okay, keeping the ticket open.', components: [] });
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

        // Check verified role for order tickets
        const VERIFIED_ROLE_ID = '1297874929085317150';
        if (!interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
          return interaction.editReply({ content: '❌ You must be verified to open order tickets. Please verify your account first.' });
        }

        // Blacklist check for order tickets
        const { isBlacklisted } = require('../utils/ticketBlacklist');
        const blocked = await isBlacklisted(interaction.user.id, 'order').catch(()=>false);
        if (blocked) {
          return interaction.editReply({ content: '❌ You are blacklisted from opening order tickets.' });
        }

        const category = interaction.customId.split(':')[1];
        const details = interaction.fields.getTextInputValue('details');
        const deadline = interaction.fields.getTextInputValue('deadline');

        // Use Bloxlink API to fetch Roblox username
        let robloxUsername = null;
        try {
          const { getDiscordIdsFromRoblox } = require('../utils/bloxlinkApi');
          const axios = require('axios');
          const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;
          
          // Use Bloxlink to get Roblox ID from Discord ID
          const url = `https://api.blox.link/v4/public/guilds/${interaction.guild.id}/discord-to-roblox/${interaction.user.id}`;
          const res = await axios.get(url, {
            headers: { Authorization: BLOXLINK_API_KEY },
            validateStatus: () => true
          });
          
          if (res.status === 200 && res.data?.robloxID) {
            // Now get the Roblox username from the Roblox ID
            const robloxId = res.data.robloxID;
            const userRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
            if (userRes.status === 200 && userRes.data?.name) {
              robloxUsername = userRes.data.name;
            }
          }
        } catch (err) {
          console.error('[ticket_open_modal] Bloxlink lookup error:', err);
        }

        // Create ticket channel
        const ch = await createTicketChannel(interaction.guild, interaction.user, category);
        const { getCategoryRole } = require('../utils/categoryRoleSync');
        const roleId = getCategoryRole(category);
        const welcome = buildWelcomeEmbed(interaction.user, category);
        const info = buildUserInfoEmbed(interaction.member || interaction.user);
        const form = buildFormEmbed({ roblox: robloxUsername, details, deadline });
        const buttons = buildTicketButtons(ch.id);

        await ch.send({ content: `${interaction.user}${roleId ? ` <@&${roleId}>` : ''}`, embeds: [welcome, info, form], components: [buttons] });
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

        // Blacklist check for support tickets
        const { isBlacklisted } = require('../utils/ticketBlacklist');
        const blocked = await isBlacklisted(interaction.user.id, 'support').catch(()=>false);
        if (blocked) {
          return interaction.editReply({ content: '❌ You are blacklisted from opening support tickets.' });
        }

        const category = interaction.customId.split(':')[1]; // General Support | HR Support
        const reason = interaction.fields.getTextInputValue('reason');

        // Use Bloxlink API to fetch Roblox username
        let robloxUsername = null;
        try {
          const axios = require('axios');
          const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY;
          
          // Use Bloxlink to get Roblox ID from Discord ID
          const url = `https://api.blox.link/v4/public/guilds/${interaction.guild.id}/discord-to-roblox/${interaction.user.id}`;
          const res = await axios.get(url, {
            headers: { Authorization: BLOXLINK_API_KEY },
            validateStatus: () => true
          });
          
          if (res.status === 200 && res.data?.robloxID) {
            // Now get the Roblox username from the Roblox ID
            const robloxId = res.data.robloxID;
            const userRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
            if (userRes.status === 200 && userRes.data?.name) {
              robloxUsername = userRes.data.name;
            }
          }
        } catch (err) {
          console.error('[support_open_modal] Bloxlink lookup error:', err);
        }

        // Create ticket channel with hardcoded category IDs (handled in createTicketChannelWithParent)
        const { createTicketChannelWithParent } = require('../utils/ticketUtils');
        const ch = await createTicketChannelWithParent(interaction.guild, interaction.user, category, null);
        const { getSupportRoles } = require('../utils/categoryRoleSync');
        const supportRoles = getSupportRoles();
        const roleId = supportRoles[category];
        
        // Build embeds using the same structure as order tickets
        const { buildSupportWelcomeEmbed, buildUserInfoEmbed, buildSupportFormEmbed } = require('../utils/ticketUtils');
        const welcome = buildSupportWelcomeEmbed(interaction.user, category);
        const info = buildUserInfoEmbed(interaction.member || interaction.user);
        const form = buildSupportFormEmbed({ roblox: robloxUsername, details: reason });
        const buttons = buildTicketButtons(ch.id);
        await ch.send({ content: `${interaction.user}${roleId ? ` <@&${roleId}>` : ''}`, embeds: [welcome, info, form], components: [buttons] });
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `✅ Support ticket created: ${ch}` });
        } else {
          await interaction.reply({ content: `✅ Support ticket created: ${ch}`, flags: 64 });
        }
        return;
      }

      if (interaction.customId.startsWith('payout_deny_modal:')) {
        await interaction.deferUpdate();
        const [, payoutId, requesterId] = interaction.customId.split(':');
        const reason = interaction.fields.getTextInputValue('reason');
        const { decidePayout, getPayoutById } = require('../utils/payoutManager');
        await decidePayout(Number(payoutId), 'DENIED', interaction.user.id, reason);
        const payout = await getPayoutById(Number(payoutId));
        
        // Send DM to designer
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
              .setColor(0xFF0000) // Red
              .setFooter({ text: `Denied by ${interaction.user.tag}` });
            await user.send({ embeds: [dm] }).catch(()=>{});
          }
        } catch {}
        
        // Edit the original message embed
        const { EmbedBuilder } = require('discord.js');
        const updatedEmbed = new EmbedBuilder()
          .setTitle('Payment Denied')
          .setColor(0xFF0000) // Red
          .setDescription(`${interaction.user} denied this payout request.`)
          .addFields(
            { name: 'Designer', value: `<@${payout.designer_id}>`, inline: true },
            { name: 'Orders', value: String(payout.order_count), inline: true },
            { name: 'Total (Robux)', value: String(payout.total_amount), inline: true },
            { name: 'Requested (Robux)', value: String(payout.payout_amount), inline: true },
            { name: 'Denied By', value: `${interaction.user}`, inline: true },
            { name: 'Reason', value: reason },
          )
          .setFooter({ text: `Payout ID: ${payoutId} • Denied at ${new Date().toUTCString()}` });
        
        // Find and edit the original payout request message
        const approvalChannel = interaction.client.channels.cache.get('1458206214528962751');
        if (approvalChannel && approvalChannel.isTextBased()) {
          // Search for the message with this payout ID
          const messages = await approvalChannel.messages.fetch({ limit: 100 });
          const payoutMessage = messages.find(msg => 
            msg.embeds[0]?.footer?.text?.includes(`Payout ID: ${payoutId}`)
          );
          if (payoutMessage) {
            await payoutMessage.edit({ embeds: [updatedEmbed], components: [] });
          }
        }
        
        return interaction.followUp({ content: '✅ Denied and user notified.', flags: 64 });
      }

      if (interaction.customId.startsWith('ticket_close_modal:')) {
        const channelId = interaction.customId.split(':')[1];
        if (interaction.channel.id !== channelId) return interaction.reply({ content: 'Use this in the ticket channel.', ephemeral: true });
        const reason = interaction.fields.getTextInputValue('reason');
        const meta = await getTicketMeta(interaction.channel);
        return logAndCloseTicket(interaction.channel, { category: meta.category, openerId: meta.openerId, claimedBy: meta.claimedBy, closedBy: interaction.user.id, reason, ticketId: meta.ticketId });
      }
      
      if (interaction.customId.startsWith('ban_appeal_modal:')) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.customId.split(':')[1];
        
        const reasonForBan = interaction.fields.getTextInputValue('reason_for_ban').trim();
        const whyUnban = interaction.fields.getTextInputValue('why_unban').trim();
        
        // Create ban appeal in database
        const { createBanAppeal } = require('../utils/banAppeals');
        const appealId = await createBanAppeal(interaction.user.id, guildId, reasonForBan, whyUnban);
        
        // Send to appeals channel
        const APPEALS_CHANNEL_ID = '1459306472004649032';
        const guild = interaction.client.guilds.cache.get(guildId);
        
        if (!guild) {
          return interaction.editReply({ content: '❌ Could not find the server.' });
        }
        
        const appealsChannel = guild.channels.cache.get(APPEALS_CHANNEL_ID);
        
        if (!appealsChannel || !appealsChannel.isTextBased()) {
          return interaction.editReply({ content: '❌ Appeals channel not found.' });
        }
        
        // Create appeal embed
        const appealEmbed = new EmbedBuilder()
          .setTitle('📝 New Ban Appeal')
          .setColor(0xFFAA00)
          .addFields([
            { name: 'User', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: 'User ID', value: interaction.user.id, inline: true },
            { name: 'Appeal ID', value: `#${appealId}`, inline: true },
            { name: 'What led to the ban?', value: reasonForBan.slice(0, 1024), inline: false },
            { name: 'Why should they be unbanned?', value: whyUnban.slice(0, 1024), inline: false }
          ])
          .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
          .setFooter({ text: `Appeal ID: ${appealId}` })
          .setTimestamp();
        
        // Create approve/deny buttons
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ban_appeal_approve:${appealId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`ban_appeal_deny:${appealId}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );
        
        try {
          await appealsChannel.send({ embeds: [appealEmbed], components: [buttons] });
          return interaction.editReply({ content: '✅ Your ban appeal has been submitted! Our moderation team will review it shortly.' });
        } catch (e) {
          console.error('Failed to send appeal to channel:', e);
          return interaction.editReply({ content: '❌ Failed to submit appeal. Please contact a moderator.' });
        }
      }
      
      if (interaction.customId.startsWith('order_edit_designer_modal:')) {
        await interaction.deferUpdate();
        const orderId = interaction.customId.split(':')[1];
        const newDesignerId = interaction.fields.getTextInputValue('designer_id').trim();
        
        // Validate that it's a valid user ID
        if (!/^\d{17,19}$/.test(newDesignerId)) {
          return interaction.followUp({ content: '❌ Invalid user ID format.', ephemeral: true });
        }
        
        try {
          const { getPayment, updateOrder } = require('../utils/paymentManager');
          const order = await getPayment(orderId);
          const oldDesignerId = order.payee_id;
          
          // Update the order
          await updateOrder(orderId, { payee_id: newDesignerId });
          
          // Send DM to old designer if exists
          if (oldDesignerId && oldDesignerId !== newDesignerId) {
            try {
              const oldDesigner = await interaction.client.users.fetch(oldDesignerId);
              const { EmbedBuilder } = require('discord.js');
              const dmEmbed = new EmbedBuilder()
                .setTitle(`${require('../utils/branding').BRAND_NAME} — Order Reassigned`)
                .setDescription(`An order has been reassigned from you to another designer.`)
                .setColor(0xFFA500)
                .addFields(
                  { name: 'Order ID', value: orderId, inline: true },
                  { name: 'Price', value: `${order.price} Robux`, inline: true },
                  { name: 'Reason', value: order.reason || 'N/A' }
                )
                .setFooter({ text: `If you need more information, please open an HR support ticket.` });
              
              await oldDesigner.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (e) {
              console.error('Failed to send DM to old designer:', e);
            }
          }
          
          // Send DM to new designer
          try {
            const newDesigner = await interaction.client.users.fetch(newDesignerId);
            const { EmbedBuilder } = require('discord.js');
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${require('../utils/branding').BRAND_NAME} — Order Assigned`)
              .setDescription(`You have been assigned as the designer for an order.`)
              .setColor(0x00FF00)
              .addFields(
                { name: 'Order ID', value: orderId, inline: true },
                { name: 'Price', value: `${order.price} Robux`, inline: true },
                { name: 'Roblox User', value: order.roblox_username, inline: true },
                { name: 'Reason', value: order.reason || 'N/A' }
              )
              .setFooter({ text: `${require('../utils/branding').BRAND_NAME}` });
            
            await newDesigner.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM to new designer:', e);
          }
          
          await interaction.followUp({ content: '✅ Designer updated successfully. DMs sent to affected designers.', ephemeral: true });
        } catch (error) {
          console.error('Error updating designer:', error);
          await interaction.followUp({ content: '❌ Failed to update designer.', ephemeral: true });
        }
      }
      
      if (interaction.customId.startsWith('order_edit_reason_modal:')) {
        await interaction.deferUpdate();
        const orderId = interaction.customId.split(':')[1];
        const newReason = interaction.fields.getTextInputValue('reason').trim();
        
        try {
          const { getPayment, updateOrder } = require('../utils/paymentManager');
          const order = await getPayment(orderId);
          const oldReason = order.reason;
          
          // Update the order
          await updateOrder(orderId, { reason: newReason });
          
          // Send DM to designer
          if (order.payee_id) {
            try {
              const designer = await interaction.client.users.fetch(order.payee_id);
              const { EmbedBuilder } = require('discord.js');
              const dmEmbed = new EmbedBuilder()
                .setTitle(`${require('../utils/branding').BRAND_NAME} — Order Reason Updated`)
                .setDescription(`The reason for one of your orders has been updated by management.`)
                .setColor(0xFFA500)
                .addFields(
                  { name: 'Order ID', value: orderId, inline: true },
                  { name: 'Price', value: `${order.price} Robux`, inline: true },
                  { name: 'Old Reason', value: oldReason || 'N/A' },
                  { name: 'New Reason', value: newReason }
                )
                .setFooter({ text: `If you need more information, please open an HR support ticket.` });
              
              await designer.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (e) {
              console.error('Failed to send DM to designer:', e);
            }
          }
          
          await interaction.followUp({ content: '✅ Order reason updated successfully. DM sent to designer.', ephemeral: true });
        } catch (error) {
          console.error('Error updating reason:', error);
          await interaction.followUp({ content: '❌ Failed to update reason.', ephemeral: true });
        }
      }
      
      // LOA: New request modal
      if (interaction.customId === 'loa_request_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const durationStr = interaction.fields.getTextInputValue('duration').trim();
        const reason = interaction.fields.getTextInputValue('reason').trim();
        
        try {
          const { parseDuration, createLOARequest, getLOAHistory, formatDuration, LOA_REQUEST_CHANNEL_ID, MANAGEMENT_ROLE_ID } = require('../utils/loaManager');
          
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return interaction.editReply({ content: '❌ Invalid duration format. Use formats like: 1d, 2w, 3h, 30m' });
          }
          
          // Check if LOA extends past end of month (for payout check)
          const now = new Date();
          const endDate = new Date(now.getTime() + durationMs);
          const currentMonth = now.getUTCMonth();
          const endMonth = endDate.getUTCMonth();
          
          if (endMonth !== currentMonth || endDate.getUTCFullYear() !== now.getUTCFullYear()) {
            // Check if user is a designer with outstanding orders
            const designerRoleIds = [
              '1411100904949682237', // Designer role - update this to actual role ID
              // Add other designer role IDs here
            ];
            
            const hasDesignerRole = interaction.member.roles.cache.some(role => designerRoleIds.includes(role.id));
            
            if (hasDesignerRole) {
              try {
                // Check if they have a payout request for this month
                const { hasPayoutThisMonth } = require('../utils/payoutManager');
                const hasRequested = await hasPayoutThisMonth(interaction.user.id);
                
                if (!hasRequested) {
                  // Check if they have outstanding orders
                  const { getEligiblePaymentsForDesigner } = require('../utils/payoutManager');
                  const eligibleOrders = await getEligiblePaymentsForDesigner(interaction.user.id);
                  
                  if (eligibleOrders.length > 0) {
                    // They have orders but haven't requested payout
                    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const warnEmbed = new EmbedBuilder()
                      .setTitle('⚠️ Payout Reminder')
                      .setDescription(
                        `Your requested LOA extends into next month, and you have **${eligibleOrders.length} outstanding order(s)** available for payout.\n\n` +
                        `**It is recommended that you request a payout before going on leave** to ensure you receive payment for this month's work.\n\n` +
                        `You can still proceed with your LOA request, but please consider using \`/payout\` first.`
                      )
                      .setColor(0xFFA500)
                      .addFields(
                        { name: 'Outstanding Orders', value: String(eligibleOrders.length), inline: true },
                        { name: 'LOA Duration', value: formatDuration(durationMs), inline: true }
                      )
                      .setFooter({ text: 'This is just a reminder - you can still proceed.' });
                    
                    const proceedBtn = new ButtonBuilder()
                      .setCustomId(`loa_proceed_anyway:${durationMs}:${Date.now()}`)
                      .setLabel('Proceed with LOA Request')
                      .setStyle(ButtonStyle.Primary);
                    
                    const cancelBtn = new ButtonBuilder()
                      .setCustomId('loa_cancel_request')
                      .setLabel('Cancel')
                      .setStyle(ButtonStyle.Secondary);
                    
                    const row = new ActionRowBuilder().addComponents(proceedBtn, cancelBtn);
                    
                    return interaction.editReply({ embeds: [warnEmbed], components: [row] });
                  }
                }
              } catch (e) {
                console.error('Error checking payout status:', e);
                // Continue with request even if check fails
              }
            }
          }
          
          // Create LOA request
          const loaId = await createLOARequest(interaction.user.id, durationMs, reason);
          
          // Get history for context
          const history = await getLOAHistory(interaction.user.id, 3);
          
          // Send to request channel
          const requestChannel = interaction.client.channels.cache.get(LOA_REQUEST_CHANNEL_ID);
          if (requestChannel && requestChannel.isTextBased()) {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { BRAND_NAME } = require('../utils/branding');
            
            const embed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Request`)
              .setColor(0xFFA500)
              .addFields(
                { name: 'Requester', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Duration', value: formatDuration(durationMs), inline: true },
                { name: 'Ends', value: `<t:${Math.floor(endDate.getTime() / 1000)}:R>`, inline: true },
                { name: 'Reason', value: reason }
              )
              .setFooter({ text: `LOA ID: ${loaId}` })
              .setTimestamp();
            
            if (history.length > 0) {
              const historyText = history.map((loa, idx) => {
                const end = new Date(loa.end_time);
                const dur = formatDuration(loa.duration_ms);
                const status = loa.status === 'ENDED_EARLY' ? 'Ended Early' : 'Completed';
                return `${idx + 1}. Ended <t:${Math.floor(end.getTime() / 1000)}:R> (${dur}) - ${status}`;
              }).join('\n');
              
              embed.addFields({ name: '📋 Recent LOA History', value: historyText });
            }
            
            const approveBtn = new ButtonBuilder()
              .setCustomId(`loa_approve:${loaId}`)
              .setLabel('Approve')
              .setStyle(ButtonStyle.Success);
            
            const denyBtn = new ButtonBuilder()
              .setCustomId(`loa_deny:${loaId}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger);
            
            const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
            
            await requestChannel.send({ content: `<@&${MANAGEMENT_ROLE_ID}>`, embeds: [embed], components: [row] });
          }
          
          await interaction.editReply({ content: '✅ Your LOA request has been submitted to management for approval.' });
        } catch (error) {
          console.error('Error creating LOA request:', error);
          await interaction.editReply({ content: '❌ Failed to create LOA request. Please try again.' });
        }
      }
      
      // LOA: Proceed with request modal (after payout warning)
      if (interaction.customId.startsWith('loa_request_modal_proceed:')) {
        await interaction.deferReply({ ephemeral: true });
        const durationMs = parseInt(interaction.customId.split(':')[1]);
        const reason = interaction.fields.getTextInputValue('reason').trim();
        
        try {
          const { createLOARequest, getLOAHistory, formatDuration, LOA_REQUEST_CHANNEL_ID, MANAGEMENT_ROLE_ID } = require('../utils/loaManager');
          
          // Create LOA request
          const loaId = await createLOARequest(interaction.user.id, durationMs, reason);
          
          // Get history for context
          const history = await getLOAHistory(interaction.user.id, 3);
          
          const now = new Date();
          const endDate = new Date(now.getTime() + durationMs);
          
          // Send to request channel
          const requestChannel = interaction.client.channels.cache.get(LOA_REQUEST_CHANNEL_ID);
          if (requestChannel && requestChannel.isTextBased()) {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { BRAND_NAME } = require('../utils/branding');
            
            const embed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Request`)
              .setColor(0xFFA500)
              .addFields(
                { name: 'Requester', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Duration', value: formatDuration(durationMs), inline: true },
                { name: 'Ends', value: `<t:${Math.floor(endDate.getTime() / 1000)}:R>`, inline: true },
                { name: 'Reason', value: reason }
              )
              .setFooter({ text: `LOA ID: ${loaId}` })
              .setTimestamp();
            
            if (history.length > 0) {
              const historyText = history.map((loa, idx) => {
                const end = new Date(loa.end_time);
                const dur = formatDuration(loa.duration_ms);
                const status = loa.status === 'ENDED_EARLY' ? 'Ended Early' : 'Completed';
                return `${idx + 1}. Ended <t:${Math.floor(end.getTime() / 1000)}:R> (${dur}) - ${status}`;
              }).join('\n');
              
              embed.addFields({ name: '📋 Recent LOA History', value: historyText });
            }
            
            const approveBtn = new ButtonBuilder()
              .setCustomId(`loa_approve:${loaId}`)
              .setLabel('Approve')
              .setStyle(ButtonStyle.Success);
            
            const denyBtn = new ButtonBuilder()
              .setCustomId(`loa_deny:${loaId}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger);
            
            const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
            
            await requestChannel.send({ content: `<@&${MANAGEMENT_ROLE_ID}>`, embeds: [embed], components: [row] });
          }
          
          await interaction.editReply({ content: '✅ Your LOA request has been submitted to management for approval.' });
        } catch (error) {
          console.error('Error creating LOA request:', error);
          await interaction.editReply({ content: '❌ Failed to create LOA request. Please try again.' });
        }
      }
      
      // LOA: Extension request modal
      if (interaction.customId.startsWith('loa_extension_modal:')) {
        await interaction.deferReply({ ephemeral: true });
        const originalLoaId = parseInt(interaction.customId.split(':')[1]);
        
        const durationStr = interaction.fields.getTextInputValue('duration').trim();
        const reason = interaction.fields.getTextInputValue('reason').trim();
        
        try {
          const { parseDuration, createLOARequest, getLOAById, getLOAHistory, formatDuration, LOA_REQUEST_CHANNEL_ID, MANAGEMENT_ROLE_ID } = require('../utils/loaManager');
          
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return interaction.editReply({ content: '❌ Invalid duration format. Use formats like: 1d, 2w, 3h, 30m' });
          }
          
          const originalLOA = await getLOAById(originalLoaId);
          if (!originalLOA || originalLOA.user_id !== interaction.user.id) {
            return interaction.editReply({ content: '❌ Original LOA not found or not yours.' });
          }
          
          // Create extension request
          const loaId = await createLOARequest(interaction.user.id, durationMs, reason, true, originalLoaId);
          
          // Get history for context
          const history = await getLOAHistory(interaction.user.id, 3);
          
          // Send to request channel
          const requestChannel = interaction.client.channels.cache.get(LOA_REQUEST_CHANNEL_ID);
          if (requestChannel && requestChannel.isTextBased()) {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { BRAND_NAME } = require('../utils/branding');
            
            const originalEndTime = new Date(originalLOA.end_time);
            const newEndTime = new Date(originalEndTime.getTime() + durationMs);
            
            const embed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Extension Request`)
              .setColor(0xFFA500)
              .addFields(
                { name: 'Requester', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Additional Duration', value: formatDuration(durationMs), inline: true },
                { name: 'Original LOA ID', value: String(originalLoaId), inline: true },
                { name: 'Current End Time', value: `<t:${Math.floor(originalEndTime.getTime() / 1000)}:R>`, inline: true },
                { name: 'New End Time', value: `<t:${Math.floor(newEndTime.getTime() / 1000)}:R>`, inline: true },
                { name: 'Reason', value: reason }
              )
              .setFooter({ text: `Extension Request ID: ${loaId}` })
              .setTimestamp();
            
            if (history.length > 0) {
              const historyText = history.map((loa, idx) => {
                const end = new Date(loa.end_time);
                const dur = formatDuration(loa.duration_ms);
                const status = loa.status === 'ENDED_EARLY' ? 'Ended Early' : 'Completed';
                return `${idx + 1}. Ended <t:${Math.floor(end.getTime() / 1000)}:R> (${dur}) - ${status}`;
              }).join('\n');
              
              embed.addFields({ name: '📋 Recent LOA History', value: historyText });
            }
            
            const approveBtn = new ButtonBuilder()
              .setCustomId(`loa_approve:${loaId}`)
              .setLabel('Approve Extension')
              .setStyle(ButtonStyle.Success);
            
            const denyBtn = new ButtonBuilder()
              .setCustomId(`loa_deny:${loaId}`)
              .setLabel('Deny Extension')
              .setStyle(ButtonStyle.Danger);
            
            const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
            
            await requestChannel.send({ content: `<@&${MANAGEMENT_ROLE_ID}>`, embeds: [embed], components: [row] });
          }
          
          await interaction.editReply({ content: '✅ Your LOA extension request has been submitted to management for approval.' });
        } catch (error) {
          console.error('Error creating LOA extension request:', error);
          await interaction.editReply({ content: '❌ Failed to create extension request. Please try again.' });
        }
      }
      
      // LOA Admin: Start LOA modal
      if (interaction.customId === 'loa_admin_start_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.fields.getTextInputValue('user_id').trim();
        const durationStr = interaction.fields.getTextInputValue('duration').trim();
        const reason = interaction.fields.getTextInputValue('reason').trim();
        
        try {
          const { parseDuration, createLOARequest, approveLOA, formatDuration, LOA_ROLE_ID, LOA_LOGS_CHANNEL_ID } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME } = require('../utils/branding');
          
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return interaction.editReply({ content: '❌ Invalid duration format. Use formats like: 1d, 2w, 3h, 30m' });
          }
          
          // Validate user ID
          if (!/^\d{17,19}$/.test(userId)) {
            return interaction.editReply({ content: '❌ Invalid user ID format.' });
          }
          
          // Create and immediately approve the LOA
          const loaId = await createLOARequest(userId, durationMs, reason);
          await approveLOA(loaId, interaction.user.id);
          
          // Assign LOA role
          try {
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.add(LOA_ROLE_ID);
          } catch (e) {
            console.error('Failed to assign LOA role:', e);
          }
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const endTime = new Date(Date.now() + durationMs);
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Started (Admin)`)
                .setColor(0x00FF00)
                .addFields(
                  { name: 'User', value: `<@${userId}>`, inline: true },
                  { name: 'Started By', value: `<@${interaction.user.id}> (Admin)`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Duration', value: formatDuration(durationMs), inline: true },
                  { name: 'Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: true },
                  { name: 'Reason', value: reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to user
          try {
            const user = await interaction.client.users.fetch(userId);
            const endTime = new Date(Date.now() + durationMs);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Started`)
              .setDescription('A leave of absence has been started for you by management.')
              .setColor(0x00FF00)
              .addFields(
                { name: 'Duration', value: formatDuration(durationMs), inline: true },
                { name: 'Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
                { name: 'Reason', value: reason }
              )
              .setFooter({ text: `Started by ${interaction.user.tag}` });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          await interaction.editReply({ 
            content: `✅ LOA started for <@${userId}>.\n**LOA ID:** ${loaId}\n**Duration:** ${formatDuration(durationMs)}` 
          });
        } catch (error) {
          console.error('Error starting LOA:', error);
          await interaction.editReply({ content: '❌ Failed to start LOA. Please try again.' });
        }
      }
      
      // LOA Admin: End LOA modal
      if (interaction.customId === 'loa_admin_end_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const loaIdStr = interaction.fields.getTextInputValue('loa_id').trim();
        const loaId = parseInt(loaIdStr);
        
        if (isNaN(loaId)) {
          return interaction.editReply({ content: '❌ Invalid LOA ID. Must be a number.' });
        }
        
        try {
          const { getLOAById, endLOA, formatDuration, LOA_ROLE_ID, LOA_LOGS_CHANNEL_ID } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME } = require('../utils/branding');
          
          const loa = await getLOAById(loaId);
          if (!loa) {
            return interaction.editReply({ content: '❌ LOA not found.' });
          }
          
          if (loa.status !== 'ACTIVE') {
            return interaction.editReply({ content: `❌ This LOA is not active (current status: ${loa.status}).` });
          }
          
          // End the LOA
          await endLOA(loaId, true);
          
          // Remove LOA role
          try {
            const member = await interaction.guild.members.fetch(loa.user_id);
            await member.roles.remove(LOA_ROLE_ID);
          } catch (e) {
            console.error('Failed to remove LOA role:', e);
          }
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const startTime = new Date(loa.start_time);
              const originalEndTime = new Date(loa.end_time);
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Ended (Admin)`)
                .setColor(0xFFA500)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Ended By', value: `<@${interaction.user.id}> (Admin)`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Started', value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
                  { name: 'Was Scheduled to End', value: `<t:${Math.floor(originalEndTime.getTime() / 1000)}:R>`, inline: true },
                  { name: 'Original Duration', value: formatDuration(loa.duration_ms), inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to user
          try {
            const user = await interaction.client.users.fetch(loa.user_id);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Ended`)
              .setDescription('Your leave of absence has been ended by management.')
              .setColor(0xFFA500)
              .addFields(
                { name: 'LOA ID', value: String(loaId), inline: true },
                { name: 'Original Duration', value: formatDuration(loa.duration_ms), inline: true },
                { name: 'Ended By', value: interaction.user.tag }
              )
              .setFooter({ text: 'If you have questions, please open an HR support ticket.' });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          await interaction.editReply({ content: `✅ LOA #${loaId} has been ended for <@${loa.user_id}>.` });
        } catch (error) {
          console.error('Error ending LOA:', error);
          await interaction.editReply({ content: '❌ Failed to end LOA. Please try again.' });
        }
      }
      
      // LOA Admin: Extend LOA modal
      if (interaction.customId === 'loa_admin_extend_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const loaIdStr = interaction.fields.getTextInputValue('loa_id').trim();
        const durationStr = interaction.fields.getTextInputValue('duration').trim();
        const loaId = parseInt(loaIdStr);
        
        if (isNaN(loaId)) {
          return interaction.editReply({ content: '❌ Invalid LOA ID. Must be a number.' });
        }
        
        try {
          const { getLOAById, extendLOA, parseDuration, formatDuration, LOA_LOGS_CHANNEL_ID } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME } = require('../utils/branding');
          
          const loa = await getLOAById(loaId);
          if (!loa) {
            return interaction.editReply({ content: '❌ LOA not found.' });
          }
          
          if (loa.status !== 'ACTIVE') {
            return interaction.editReply({ content: `❌ This LOA is not active (current status: ${loa.status}).` });
          }
          
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return interaction.editReply({ content: '❌ Invalid duration format. Use formats like: 1d, 2w, 3h, 30m' });
          }
          
          const oldEndTime = new Date(loa.end_time);
          
          // Extend the LOA
          await extendLOA(loaId, durationMs);
          
          // Get updated LOA
          const updatedLOA = await getLOAById(loaId);
          const newEndTime = new Date(updatedLOA.end_time);
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Extended (Admin)`)
                .setColor(0x00FF00)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Extended By', value: `<@${interaction.user.id}> (Admin)`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Additional Duration', value: formatDuration(durationMs), inline: true },
                  { name: 'Previous End Time', value: `<t:${Math.floor(oldEndTime.getTime() / 1000)}:F>`, inline: true },
                  { name: 'New End Time', value: `<t:${Math.floor(newEndTime.getTime() / 1000)}:F>`, inline: true },
                  { name: 'Reason', value: loa.reason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to user
          try {
            const user = await interaction.client.users.fetch(loa.user_id);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Extended`)
              .setDescription('Your leave of absence has been extended by management.')
              .setColor(0x00FF00)
              .addFields(
                { name: 'LOA ID', value: String(loaId), inline: true },
                { name: 'Additional Duration', value: formatDuration(durationMs), inline: true },
                { name: 'New End Time', value: `<t:${Math.floor(newEndTime.getTime() / 1000)}:R>`, inline: true },
                { name: 'Extended By', value: interaction.user.tag }
              )
              .setFooter({ text: BRAND_NAME });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          await interaction.editReply({ 
            content: `✅ LOA #${loaId} has been extended by ${formatDuration(durationMs)}.\n**New end time:** <t:${Math.floor(newEndTime.getTime() / 1000)}:F>` 
          });
        } catch (error) {
          console.error('Error extending LOA:', error);
          await interaction.editReply({ content: '❌ Failed to extend LOA. Please try again.' });
        }
      }
      
      // LOA Admin: Edit Reason modal
      if (interaction.customId === 'loa_admin_edit_modal') {
        await interaction.deferReply({ ephemeral: true });
        
        const loaIdStr = interaction.fields.getTextInputValue('loa_id').trim();
        const newReason = interaction.fields.getTextInputValue('reason').trim();
        const loaId = parseInt(loaIdStr);
        
        if (isNaN(loaId)) {
          return interaction.editReply({ content: '❌ Invalid LOA ID. Must be a number.' });
        }
        
        try {
          const { getLOAById, updateLOAReason, LOA_LOGS_CHANNEL_ID } = require('../utils/loaManager');
          const { EmbedBuilder } = require('discord.js');
          const { BRAND_NAME } = require('../utils/branding');
          
          const loa = await getLOAById(loaId);
          if (!loa) {
            return interaction.editReply({ content: '❌ LOA not found.' });
          }
          
          const oldReason = loa.reason;
          
          // Update the reason
          await updateLOAReason(loaId, newReason, interaction.user.id);
          
          // Send log to LOA logs channel
          try {
            const logsChannel = interaction.client.channels.cache.get(LOA_LOGS_CHANNEL_ID);
            if (logsChannel && logsChannel.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setTitle(`${BRAND_NAME} — LOA Reason Edited (Admin)`)
                .setColor(0xFFA500)
                .addFields(
                  { name: 'User', value: `<@${loa.user_id}>`, inline: true },
                  { name: 'Edited By', value: `<@${interaction.user.id}> (Admin)`, inline: true },
                  { name: 'LOA ID', value: String(loaId), inline: true },
                  { name: 'Status', value: loa.status, inline: true },
                  { name: 'Old Reason', value: oldReason },
                  { name: 'New Reason', value: newReason }
                )
                .setFooter({ text: BRAND_NAME })
                .setTimestamp();
              
              await logsChannel.send({ embeds: [logEmbed] });
            }
          } catch (e) {
            console.error('Failed to send LOA log:', e);
          }
          
          // Send DM to user
          try {
            const user = await interaction.client.users.fetch(loa.user_id);
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${BRAND_NAME} — LOA Reason Updated`)
              .setDescription('The reason for your leave of absence has been updated by management.')
              .setColor(0xFFA500)
              .addFields(
                { name: 'LOA ID', value: String(loaId), inline: true },
                { name: 'Status', value: loa.status, inline: true },
                { name: 'Old Reason', value: oldReason },
                { name: 'New Reason', value: newReason },
                { name: 'Updated By', value: interaction.user.tag }
              )
              .setFooter({ text: 'If you have questions, please open an HR support ticket.' });
            
            await user.send({ embeds: [dmEmbed] }).catch(() => {});
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
          
          await interaction.editReply({ 
            content: `✅ LOA #${loaId} reason has been updated.\n**Old:** ${oldReason}\n**New:** ${newReason}` 
          });
        } catch (error) {
          console.error('Error editing LOA reason:', error);
          await interaction.editReply({ content: '❌ Failed to edit LOA reason. Please try again.' });
        }
      }
    }

    // Catch-all handler for buttons created in embed dashboard
    if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
      // If we reach here, the button wasn't handled by any specific handler above
      const customId = interaction.customId;
      
      // Skip if this is a known button handled above (these may show modals which don't set replied/deferred flags)
      const knownButtons = [
        'catrole_save', 'payout_approve', 'payout_deny', 'log_order',
        'loa_request_new', 'loa_request_extension', 'loa_end_early', 'loa_proceed_anyway', 'loa_cancel_request',
        'loa_approve', 'loa_deny', 'loa_admin_start', 'loa_admin_end', 'loa_admin_extend', 'loa_admin_edit',
        'catrole_role', 'catrole_select', 'soi_proceed', 'soi_page',
        'ticket_delay_confirm', 'ticket_delay_cancel', 'ticket_claim', 'ticket_close_reason', 'ticket_close',
        'ticket_close_confirm', 'ticket_close_cancel', 'close_req_confirm', 'close_req_keep',
        'order_edit_void', 'order_edit_designer', 'order_edit_reason'
      ];
      
      const isKnownButton = knownButtons.some(btn => customId === btn || customId.startsWith(btn + ':'));
      if (isKnownButton) {
        return; // Already handled above
      }
      
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
