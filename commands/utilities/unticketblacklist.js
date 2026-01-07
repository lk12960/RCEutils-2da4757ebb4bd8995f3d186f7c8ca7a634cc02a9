const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { removeBlacklist } = require('../../utils/ticketBlacklist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unticketblacklist')
    .setDescription('Remove a user from the ticket blacklist')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('User to un-blacklist').setRequired(true))
    .addStringOption(o => o.setName('scope').setDescription('Scope to remove').addChoices(
      { name: 'Order', value: 'order' },
      { name: 'Support', value: 'support' },
      { name: 'All', value: 'all' },
    ).setRequired(true)),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', flags: 64 });
    }

    const user = interaction.options.getUser('user', true);
    const scope = interaction.options.getString('scope', true);

    const ok = await removeBlacklist(user.id, scope);
    if (ok) return interaction.reply({ content: `✅ Removed ${user} from ${scope} ticket blacklist.`, flags: 64 });
    return interaction.reply({ content: `ℹ️ ${user} was not blacklisted for ${scope}.`, flags: 64 });
  }
};
