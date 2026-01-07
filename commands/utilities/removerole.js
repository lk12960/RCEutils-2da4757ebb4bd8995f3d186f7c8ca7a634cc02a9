const { SlashCommandBuilder } = require('discord.js');
const { isModerator } = require('../../utils/permissions'); // your custom permission check

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to remove')
        .setRequired(true)),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Custom permission check here instead of ManageRoles
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to manage roles.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "❌ I don't have permission to remove that role.", ephemeral: true });
    }

    try {
      await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);
      await interaction.reply({ content: `Removed role **${role.name}** from ${user.tag}.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to remove role. Check my permissions and role hierarchy.', ephemeral: true });
    }
  },
};
