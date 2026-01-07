const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isManagement } = require('../../utils/permissions');
const { setTierRole, getAllTiers, initCacheForGuild } = require('../../utils/rolesManager');

const TIERS = ['management1','management2','moderator','staff','verified'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permissions-set')
    .setDescription('Owner-only: Set which roles correspond to tiers (management, moderator, staff, verified)')
    .addStringOption(o => o.setName('tier').setDescription('Tier to set').addChoices(
      { name: 'management1', value: 'management1' },
      { name: 'management2', value: 'management2' },
      { name: 'moderator', value: 'moderator' },
      { name: 'staff', value: 'staff' },
      { name: 'verified', value: 'verified' },
    ).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Discord role for the tier').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isOwner = interaction.guild && interaction.user.id === interaction.guild.ownerId;
    if (!isOwner) {
      return interaction.reply({ content: '❌ Only the server owner can change permission tiers.', ephemeral: true });
    }

    const tier = interaction.options.getString('tier');
    const role = interaction.options.getRole('role');

    if (!TIERS.includes(tier)) {
      return interaction.reply({ content: 'Invalid tier provided.', ephemeral: true });
    }

    await setTierRole(interaction.guild.id, tier, role.id);
    await initCacheForGuild(interaction.guild.id); // refresh cache

    const all = getAllTiers(interaction.guild.id);

    return interaction.reply({ content: `✅ Set ${tier} role to <@&${role.id}>. Current map: ${Object.entries(all).map(([t, r]) => `${t}: <@&${r}>`).join(', ')}`, ephemeral: true });
  }
};
