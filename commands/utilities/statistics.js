const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { summarize } = require('../../utils/stats');
const { requireTier } = require('../../utils/permissions');
const { BRAND_COLOR_HEX } = require('../../utils/branding');

const GROUPS = {
  membership: ['member_join','member_leave'],
  messages_commands: ['message','command'],
  moderation: ['ban','kick','warn','mute','moderation_voided'],
  tickets_orders: ['ticket_open','order','robux_made'],
  reviews: ['review','review_5'],
  infractions: ['infraction','infraction_voided','ticket_blacklisted'],
};

function parseSince(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function buildSummaryEmbed(guildId, sinceIso, totals, group) {
  const e = new EmbedBuilder().setTitle("King's Customs — Statistics").setColor(BRAND_COLOR_HEX);
  if (sinceIso) e.setDescription(`Since ${sinceIso}`);
  const add = (name, val) => e.addFields({ name, value: String(val), inline: true });
  const t = (k)=> totals[k] || 0;
  if (!group || group==='all') {
    add('Members Gained', t('member_join'));
    add('Members Lost', t('member_leave'));
    add('Messages Sent', t('message'));
    add('Commands Executed', t('command'));
    add('Bans', t('ban'));
    add('Kicks', t('kick'));
    add('Warnings', t('warn'));
    add('Mutes', t('mute'));
    add('Tickets Opened', t('ticket_open'));
    add('Orders Made', t('order'));
    add('Total Robux Made', t('robux_made'));
    add('Reviews Made', t('review'));
    add('5★ Reviews', t('review_5'));
    add('Infractions Issued', t('infraction'));
    add('Users Ticket Blacklisted', t('ticket_blacklisted'));
    add('Moderations Voided', t('moderation_voided'));
    add('Infractions Voided', t('infraction_voided'));
    add('Applications Submitted', t('applications_submitted'));
    add('Applications Accepted', t('applications_accepted'));
    add('Applications Denied', t('applications_denied'));
    add('Applications Pending', t('applications_pending'));
  } else {
    for (const k of GROUPS[group]) add(k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), t(k));
  }
  return e;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statistics')
    .setDescription('View bot/server statistics (management only).')
    .addStringOption(o=>o.setName('since-date').setDescription('ISO date (e.g., 2025-01-01)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    const sinceInput = interaction.options.getString('since-date') || null;
    const sinceIso = parseSince(sinceInput);

    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });

    const groups = [...new Set(Object.values(GROUPS).flat())];
    const totals = await summarize(interaction.guild.id, sinceIso, groups);
    
    // Add application statistics
    try {
      const { getStatistics } = require('../../utils/applicationsManager');
      const appStats = await getStatistics();
      totals.applications_submitted = appStats.total_submitted || 0;
      totals.applications_accepted = appStats.accepted || 0;
      totals.applications_denied = appStats.denied || 0;
      totals.applications_pending = appStats.pending || 0;
    } catch (err) {
      console.error('Failed to get application statistics:', err);
    }

    const selector = new StringSelectMenuBuilder()
      .setCustomId(`stats_select:${interaction.user.id}:${sinceIso || ''}`)
      .setPlaceholder('Select a statistics view')
      .addOptions([
        { label: 'All', value: 'all', description: 'Show all tracked statistics' },
        { label: 'Membership', value: 'membership' },
        { label: 'Messages & Commands', value: 'messages_commands' },
        { label: 'Moderation', value: 'moderation' },
        { label: 'Tickets & Orders', value: 'tickets_orders' },
        { label: 'Reviews', value: 'reviews' },
        { label: 'Infractions', value: 'infractions' },
      ]);

    const embed = buildSummaryEmbed(interaction.guild.id, sinceIso, totals, 'all');
    await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selector)] });
  }
};
