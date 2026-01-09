const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllActiveLOAs, formatDuration } = require('../../utils/loaManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');
const { requireTier } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave-active')
    .setDescription('View all active LOAs (Staff only)'),

  async execute(interaction) {
    // Check if user is management
    const isManagement = interaction.member.permissions.has('ManageGuild') || 
                         interaction.user.id === interaction.guild.ownerId;
    
    if (!isManagement) {
      return interaction.reply({ content: '❌ This command is only available to management.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const activeLOAs = await getAllActiveLOAs();
      
      if (activeLOAs.length === 0) {
        return interaction.editReply({ content: '✅ No staff members are currently on leave.' });
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`${BRAND_NAME} — Active Leaves of Absence`)
        .setColor(BRAND_COLOR_HEX)
        .setDescription(`${activeLOAs.length} staff member${activeLOAs.length !== 1 ? 's' : ''} currently on leave`)
        .setFooter({ text: BRAND_NAME })
        .setTimestamp();
      
      for (const loa of activeLOAs) {
        const startTime = new Date(loa.start_time);
        const endTime = new Date(loa.end_time);
        const now = Date.now();
        const remainingMs = endTime.getTime() - now;
        const totalDuration = formatDuration(loa.duration_ms);
        const remainingDuration = formatDuration(Math.max(0, remainingMs));
        
        const fieldValue = [
          `**Started:** <t:${Math.floor(startTime.getTime() / 1000)}:R>`,
          `**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`,
          `**Duration:** ${totalDuration}`,
          `**Remaining:** ${remainingDuration}`,
          `**Reason:** ${loa.reason}`
        ].join('\n');
        
        embed.addFields({
          name: `<@${loa.user_id}> (LOA #${loa.id})`,
          value: fieldValue,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching active LOAs:', error);
      return interaction.editReply({ content: '❌ An error occurred while fetching active LOAs.' });
    }
  }
};
