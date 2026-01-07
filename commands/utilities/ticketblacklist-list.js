const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { listBlacklisted } = require('../../utils/ticketBlacklist');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketblacklist-list')
    .setDescription('Show all users blacklisted from tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    const rows = await listBlacklisted();
    if (!rows.length) {
      return interaction.editReply({ content: '✅ No users are currently blacklisted.' });
    }

    // Paginate if too many; for now, build a compact embed up to ~20-25 entries
    const lines = rows.map(r => {
      const date = new Date(r.created_at).toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
      return `• <@${r.user_id}> — ${r.scope} — ${r.reason || 'No reason'} — by <@${r.moderator_id}> — ${date} UTC`;
    });

    const chunks = [];
    let current = [];
    let len = 0;
    for (const line of lines) {
      if (len + line.length + 1 > 3800) { chunks.push(current.join('\n')); current = [line]; len = line.length; } else { current.push(line); len += line.length + 1; }
    }
    if (current.length) chunks.push(current.join('\n'));

    const embeds = chunks.map((chunk, idx) => new EmbedBuilder()
      .setTitle(`Ticket Blacklist${chunks.length>1?` (Page ${idx+1}/${chunks.length})`:''}`)
      .setColor(BRAND_COLOR_HEX)
      .setDescription(chunk));

    return interaction.editReply({ embeds });
  }
};
