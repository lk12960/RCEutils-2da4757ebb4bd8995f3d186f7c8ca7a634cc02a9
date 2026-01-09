const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireTier } = require('../../utils/permissions');
const { getTicketMeta } = require('../../utils/ticketUtils');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim this ticket (staff only)'),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'staff')) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    const meta = await getTicketMeta(interaction.channel);
    if (!meta.category) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
    
    if (!meta.claimedBy) {
      return interaction.reply({ content: '❌ This ticket is not currently claimed.', ephemeral: true });
    }
    
    const previousClaimer = meta.claimedBy;
    meta.claimedBy = null;
    try { await interaction.channel.setTopic(JSON.stringify(meta)); } catch {}
    
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Unclaimed')
      .setDescription(`This ticket has been unclaimed and is now available for other staff members.`)
      .setColor(BRAND_COLOR_HEX)
      .addFields(
        { name: 'Previously Claimed By', value: `<@${previousClaimer}>`, inline: true },
        { name: 'Unclaimed By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Unclaimed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: BRAND_NAME })
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
  }
};
