const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllActiveLOAs, formatDuration } = require('../../utils/loaManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave-admin')
    .setDescription('Manage LOAs (Management only)')
    .addUserOption(o => o.setName('user').setDescription('User to manage LOA for (optional)').setRequired(false)),

  async execute(interaction) {
    // Check if user is management
    const isManagement = interaction.member.permissions.has('ManageGuild') || 
                         interaction.user.id === interaction.guild.ownerId;
    
    if (!isManagement) {
      return interaction.reply({ content: '❌ This command is only available to management.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    
    const targetUser = interaction.options.getUser('user');

    try {
      const activeLOAs = await getAllActiveLOAs();
      
      const embed = new EmbedBuilder()
        .setTitle(`${BRAND_NAME} — LOA Admin Panel`)
        .setColor(BRAND_COLOR_HEX)
        .setDescription(targetUser ? `Managing LOA for: ${targetUser.tag}` : 'Select an action below to manage leaves of absence.')
        .setFooter({ text: BRAND_NAME })
        .setTimestamp();
      
      if (targetUser) {
        embed.addFields({ name: 'Target User', value: `<@${targetUser.id}>`, inline: true });
      }
      
      if (activeLOAs.length > 0) {
        const loaList = activeLOAs.slice(0, 10).map(loa => {
          const endTime = new Date(loa.end_time);
          const remainingMs = endTime.getTime() - Date.now();
          const remaining = formatDuration(Math.max(0, remainingMs));
          return `**#${loa.id}** - <@${loa.user_id}> (${remaining} remaining)\n*Reason:* ${loa.reason}`;
        }).join('\n\n');
        
        embed.addFields({ name: `Active LOAs (${activeLOAs.length})`, value: loaList.length > 1024 ? loaList.substring(0, 1021) + '...' : loaList });
      } else {
        embed.addFields({ name: 'Active LOAs', value: 'No active LOAs' });
      }
      
      const startBtn = new ButtonBuilder()
        .setCustomId(targetUser ? `loa_admin_start:${targetUser.id}` : 'loa_admin_start')
        .setLabel('Start LOA')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️');
      
      const endBtn = new ButtonBuilder()
        .setCustomId('loa_admin_end')
        .setLabel('End LOA')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️')
        .setDisabled(activeLOAs.length === 0);
      
      const extendBtn = new ButtonBuilder()
        .setCustomId('loa_admin_extend')
        .setLabel('Extend LOA')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏱️')
        .setDisabled(activeLOAs.length === 0);
      
      const editBtn = new ButtonBuilder()
        .setCustomId('loa_admin_edit')
        .setLabel('Edit Reason')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
        .setDisabled(activeLOAs.length === 0);
      
      const row = new ActionRowBuilder().addComponents(startBtn, endBtn, extendBtn, editBtn);
      
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Error in leave-admin:', error);
      await interaction.editReply({ content: '❌ An error occurred while loading the admin panel.' });
    }
  }
};
