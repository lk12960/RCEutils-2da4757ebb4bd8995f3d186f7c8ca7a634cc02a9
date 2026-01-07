const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { setSetting } = require('../../utils/settingsManager');
const { isManagement } = require('../../utils/permissions');
const { resolveSupportCategory, createTicketChannelWithParent } = require('../../utils/ticketUtils');
const { ensureSupportRoles } = require('../../utils/categoryRoleSync');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support-setup')
    .setDescription('Owner/Management: Create a Support panel with dropdown for General/HR')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // Acknowledge immediately to avoid timeouts
    let acknowledged = false;
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 }); // ephemeral via flags
        acknowledged = true;
      }
    } catch {}

    // Permission guard
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      try {
        if (acknowledged || interaction.deferred) return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
        if (interaction.replied) return interaction.followUp({ content: '❌ You do not have permission to use this command.', flags: 64 });
        return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
      } catch { return; }
    }

    try {
      // Ensure/resolve Support category
      let supportCat = await resolveSupportCategory(interaction.guild);
      if (!supportCat) {
        supportCat = await interaction.guild.channels.create({ name: 'Support', type: ChannelType.GuildCategory, reason: '/support-setup create Support' });
        await setSetting('support_category_id', supportCat.id);
      }

      // Ensure roles for auto-mentions
      try { await ensureSupportRoles(interaction.guild); } catch {} // keeps Support roles only


      // Build embeds (images and text as specified)
      const img1 = new EmbedBuilder()
        .setColor(BRAND_COLOR_HEX)
        .setImage('https://message.style/cdn/images/d4f916eb6818e8c9ebd3197ceaa327ea1c142f11f45cdc98e3c53088b6c4b3c1.png');

      const img2 = new EmbedBuilder()
        .setTitle('Welcome to Support!')
        .setDescription("If you’re experiencing issues or need assistance, please open a ticket so our team can assist you.")
        .addFields(
          { name: 'General Support:', value: '> - Reporting bugs or issues\n> - Technical Help\n> - General Inquiries', inline: true },
          { name: 'HR Support:', value: '> - Applying for roles\n> - Appeals\n> - Partnerships\n> - Advanced Inquiries', inline: true },
        )
        .setImage('https://message.style/cdn/images/48f273307deeb87a887e77d64e64d15b20ec69a1e8ffa75a673776e97438a992.png')
        .setFooter({ text: 'Thank you for choosing Kings Customs', iconURL: 'https://cdn.discordapp.com/attachments/1344821240564682856/1457891305224015972/WhiteOutlined.png?ex=695da695&is=695c5515&hm=6e566d2c9feee28d97cdea05daee9af3683b92f527670e27900713de257291c1&animated=true' })
        .setColor(BRAND_COLOR_HEX);

      // Create or get #support channel
      const supportChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'support' && c.type === ChannelType.GuildText)
        || await interaction.guild.channels.create({ name: 'support', type: ChannelType.GuildText, parent: supportCat.id, reason: '/support-setup create support channel' });

      // Dropdown for General/HR
      const select = new StringSelectMenuBuilder()
        .setCustomId('support_select')
        .setPlaceholder('Select a support category')
        .addOptions([
          { label: 'General Support', value: 'General Support', description: 'Bugs, technical help, general inquiries' },
          { label: 'HR Support', value: 'HR Support', description: 'Roles, appeals, partnerships, advanced inquiries' },
        ]);
      const row = new ActionRowBuilder().addComponents(select);

      await supportChannel.send({ embeds: [img1, img2], components: [row] });

      if (acknowledged || interaction.deferred) return interaction.editReply({ content: `✅ Support panel deployed in ${supportChannel}.` });
      if (interaction.replied) return interaction.followUp({ content: `✅ Support panel deployed in ${supportChannel}.`, flags: 64 });
      return interaction.reply({ content: `✅ Support panel deployed in ${supportChannel}.`, flags: 64 });
    } catch (e) {
      console.error('support-setup error:', e);
      try {
        if (acknowledged || interaction.deferred) return interaction.editReply({ content: '❌ Failed to deploy support panel.' });
        if (interaction.replied) return interaction.followUp({ content: '❌ Failed to deploy support panel.', flags: 64 });
        return interaction.reply({ content: '❌ Failed to deploy support panel.', flags: 64 });
      } catch {}
    }
  }
};
