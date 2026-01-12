const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { createCase } = require('../../utils/caseManager');
const { isModerator } = require('../../utils/permissions'); // custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Softban a user (ban then unban, deleting recent messages)')
    .addUserOption(option =>
      option.setName('target').setDescription('User to softban').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for softban').setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(target.id);

      // Ban the user deleting 1 day of messages (can be 0-7)
      await interaction.guild.bans.create(target.id, {
        deleteMessageDays: 1,
        reason,
      });

      // Immediately unban user
      await interaction.guild.bans.remove(target.id, 'Softban: immediate unban');

      // Create case and log
      const caseId = await createCase(interaction.guild.id, target.id, interaction.user.id, 'Softban', reason);
      const timestamp = new Date();

      const embed = new EmbedBuilder()
        .setColor(0xe67e22) // orange
        .setTitle('🚫 Member Softbanned')
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

      await interaction.reply({ content: `🚫 Softbanned ${target.tag}.\n🆔 Case #${caseId}`, ephemeral: false });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Failed to softban the user.', ephemeral: true });
    }
  },
};
