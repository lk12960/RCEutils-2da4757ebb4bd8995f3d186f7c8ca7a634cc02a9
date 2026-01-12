const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { createCase } = require('../../utils/caseManager');
const { isModerator } = require('../../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a user\'s mute (timeout)')
    .addUserOption(option =>
      option.setName('target').setDescription('User to unmute').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for unmuting').setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
    }

    if (!member.communicationDisabledUntil) {
      return interaction.reply({ content: '❌ This user is not currently muted.', ephemeral: true });
    }

    try {
      await member.timeout(null, reason);
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: '❌ Failed to unmute the user.', ephemeral: true });
    }

    const caseId = await createCase(interaction.guild.id, target.id, interaction.user.id, 'Unmute', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f) // yellow
      .setTitle('🔈 Member Unmuted')
      .addFields(
        { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await interaction.reply({
      content: `🔈 **${target.tag}** has been unmuted.\n🆔 Case #${caseId}`,
      ephemeral: false,
    });
  },
};
