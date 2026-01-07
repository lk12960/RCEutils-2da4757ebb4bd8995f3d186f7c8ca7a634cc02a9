const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../../utils/permissions');
const { getTicketMeta } = require('../../utils/ticketUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeuser')
    .setDescription('Remove a user from this ticket channel')
    .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);

    // Only allowed for current claimer or Staff
    const meta = await getTicketMeta(interaction.channel);
    const isClaimer = meta && meta.claimedBy === interaction.user.id;
    if (!isClaimer && !isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Only the ticket claimer or Staff may use this command.', ephemeral: true });
    }

    try {
      // Remove explicit overwrite; if they inherit visibility from roles, they may still see it
      await interaction.channel.permissionOverwrites.delete(user.id).catch(async () => {
        // Fallback to explicitly deny view
        await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      });
      return interaction.reply({ content: `✅ Removed ${user} from this ticket.`, ephemeral: true });
    } catch (e) {
      console.error('removeuser error:', e);
      return interaction.reply({ content: '❌ Failed to remove user from this ticket.', ephemeral: true });
    }
  }
};
