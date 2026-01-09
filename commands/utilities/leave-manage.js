const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getActiveLOA, getLOAHistory, formatDuration } = require('../../utils/loaManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');
const { requireTier } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave-manage')
    .setDescription('Manage your Leave of Absence (LOA)'),

  async execute(interaction) {
    // Check if user is staff
    if (!requireTier(interaction.member, 'staff')) {
      return interaction.reply({ content: '❌ This command is only available to staff members.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const activeLOA = await getActiveLOA(interaction.user.id);
      
      if (activeLOA) {
        // Show active LOA details
        await showActiveLOA(interaction, activeLOA);
      } else {
        // Show LOA history and option to request new LOA
        await showLOAMenu(interaction);
      }
    } catch (error) {
      console.error('Error in leave-manage:', error);
      return interaction.editReply({ content: '❌ An error occurred while loading your LOA information.' });
    }
  }
};

/**
 * Show the main LOA menu with history
 */
async function showLOAMenu(interaction) {
  const history = await getLOAHistory(interaction.user.id, 3);
  
  const embed = new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — Manage Leave of Absences`)
    .setColor(BRAND_COLOR_HEX)
    .setDescription('You currently have no active leave. Use the button below to request a new LOA.')
    .setFooter({ text: BRAND_NAME })
    .setTimestamp();
  
  // Add LOA history if exists
  if (history.length > 0) {
    const lastLOA = history[0];
    const endDate = new Date(lastLOA.end_time);
    const duration = formatDuration(lastLOA.duration_ms);
    
    embed.addFields({
      name: '📋 Recent LOA History',
      value: `**Last Leave Ended:** <t:${Math.floor(endDate.getTime() / 1000)}:R>\n**Duration:** ${duration}\n**Status:** ${lastLOA.status === 'ENDED_EARLY' ? 'Ended Early' : 'Completed'}`
    });
    
    if (history.length > 1) {
      const otherLOAs = history.slice(1).map((loa, idx) => {
        const end = new Date(loa.end_time);
        const dur = formatDuration(loa.duration_ms);
        return `${idx + 2}. Ended <t:${Math.floor(end.getTime() / 1000)}:R> (${dur})`;
      }).join('\n');
      
      embed.addFields({
        name: '📜 Additional History',
        value: otherLOAs
      });
    }
  } else {
    embed.addFields({
      name: '📋 Recent LOA History',
      value: 'No previous LOA records found.'
    });
  }
  
  const button = new ButtonBuilder()
    .setCustomId('loa_request_new')
    .setLabel('Request New LOA')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝');
  
  const row = new ActionRowBuilder().addComponents(button);
  
  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Show active LOA details with options
 */
async function showActiveLOA(interaction, loa) {
  const startTime = new Date(loa.start_time);
  const endTime = new Date(loa.end_time);
  const now = Date.now();
  const remainingMs = endTime.getTime() - now;
  const totalDuration = formatDuration(loa.duration_ms);
  const remainingDuration = formatDuration(Math.max(0, remainingMs));
  
  const embed = new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — Active Leave of Absence`)
    .setColor(0x00FF00) // Green for active
    .setDescription('You currently have an active leave.')
    .addFields(
      { name: '⏱️ Total Length', value: totalDuration, inline: true },
      { name: '🕐 Started', value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
      { name: '⏰ Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
      { name: '⏳ Remaining', value: remainingDuration, inline: true },
      { name: '📝 Reason', value: loa.reason }
    )
    .setFooter({ text: `LOA ID: ${loa.id} • ${BRAND_NAME}` })
    .setTimestamp();
  
  const endButton = new ButtonBuilder()
    .setCustomId(`loa_end_early:${loa.id}`)
    .setLabel('End Leave Early')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🛑');
  
  const extendButton = new ButtonBuilder()
    .setCustomId(`loa_request_extension:${loa.id}`)
    .setLabel('Request Extension')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⏱️');
  
  const row = new ActionRowBuilder().addComponents(endButton, extendButton);
  
  await interaction.editReply({ embeds: [embed], components: [row] });
}
