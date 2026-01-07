const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { setBlacklist } = require('../../utils/ticketBlacklist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('t-blacklist')
    .setDescription('Blacklist a user from opening tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    .addStringOption(o => o.setName('scope').setDescription('Scope').addChoices(
      { name: 'Order', value: 'order' },
      { name: 'Support', value: 'support' },
      { name: 'All', value: 'all' },
    ).setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner && !isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }
    const user = interaction.options.getUser('user', true);
    const scope = interaction.options.getString('scope', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await setBlacklist(user.id, scope, reason, interaction.user.id);
    return interaction.reply({ content: `✅ Blacklisted ${user} from ${scope} tickets.`, ephemeral: true });
  }
};
