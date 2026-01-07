const { SlashCommandBuilder } = require('discord.js');
const ms = require('ms');
const { isModerator } = require('../../utils/permissions'); // your custom permission check

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Manage temporary roles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a temporary role to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to assign the role to')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to assign temporarily')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Duration to keep the role (e.g., 10m, 2h, 1d)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Custom permission check here, override default ManageRoles check
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: "❌ You do not have permission to manage temporary roles.", ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const durationString = interaction.options.getString('duration');

    const duration = ms(durationString);
    if (!duration || duration < 1000) {
      return interaction.reply({ content: 'Please provide a valid duration (e.g., 10m, 2h, 1d).', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: 'User not found in this guild.', ephemeral: true });
    }

    if (!(interaction.guild.members.me.roles.highest.position > role.position)) {
      return interaction.reply({ content: "❌ I can't assign that role because it is higher than my highest role.", ephemeral: true });
    }

    try {
      await member.roles.add(role, `Temporary role assigned by ${interaction.user.tag} for ${durationString}`);

      await interaction.reply({ content: `Added role ${role.name} to ${user.tag} for ${durationString}.`, ephemeral: true });

      setTimeout(async () => {
        const refreshedMember = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (refreshedMember && refreshedMember.roles.cache.has(role.id)) {
          await refreshedMember.roles.remove(role, 'Temporary role duration expired');
        }
      }, duration);

    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'Failed to assign the role. Make sure I have the correct permissions and role hierarchy.', ephemeral: true });
    }
  },
};
