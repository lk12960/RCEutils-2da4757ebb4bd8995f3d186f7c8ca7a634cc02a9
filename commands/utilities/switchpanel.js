const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTicketMeta } = require('../../utils/ticketUtils');
const { getSetting } = require('../../utils/settingsManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('switchpanel')
    .setDescription('Switch this ticket to another panel type')
    .addStringOption(o => o.setName('type').setDescription('New panel').addChoices(
      { name: 'Order', value: 'order' },
      { name: 'General Support', value: 'general' },
      { name: 'HR Support', value: 'hr' },
    ).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const type = interaction.options.getString('type', true);
    const meta = await getTicketMeta(interaction.channel);
    if (!meta || !meta.openerId) return interaction.reply({ content: 'Not a ticket channel.', ephemeral: true });

    let parentId = null;
    let newCategory = null;
    if (type === 'order') {
      parentId = await getSetting('orders_category_id');
      newCategory = 'Order';
    } else {
      parentId = await getSetting('support_category_id');
      newCategory = (type === 'general') ? 'General Support' : 'HR Support';
    }

    try {
      if (parentId) await interaction.channel.setParent(parentId, { lockPermissions: false });
      meta.category = newCategory;
      await interaction.channel.setTopic(JSON.stringify(meta));
      return interaction.reply({ content: `✅ Switched panel to ${newCategory}.`, ephemeral: true });
    } catch (e) {
      console.error('switchpanel error:', e);
      return interaction.reply({ content: '❌ Failed to switch panel.', ephemeral: true });
    }
  }
};
