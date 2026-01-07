const { SlashCommandBuilder } = require('discord.js');
const { isModerator } = require('../../utils/permissions'); // use moderator check

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Add a role to a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to assign')
        .setRequired(true)),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Custom Discord mod permission check (override default permissions)
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to manage roles.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    // Bot role hierarchy check
    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "❌ I don't have permission to assign that role.", ephemeral: true });
    }

    try {
      await member.roles.add(role, `Role added by ${interaction.user.tag}`);
      return interaction.reply({ content: `✅ Added role **${role.name}** to ${user.tag}.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: '❌ Failed to add role. Check my permissions and role hierarchy.', ephemeral: true });
    }
  },
};
