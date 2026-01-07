const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { voidAllCasesForUser } = require('../../utils/caseManager');
const { isManagement } = require('../../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear-all-cases')
    .setDescription('Void all moderation cases for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to clear cases for')
        .setRequired(true)
    ), // removed setDefaultMemberPermissions

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Custom permission check
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    try {
      const voidedCount = await voidAllCasesForUser(user.id);

      if (voidedCount === 0) {
        return interaction.reply({ content: `⚠️ No active cases found for ${user.tag}.`, ephemeral: true });
      }

      const timestamp = new Date();
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c) // red
        .setTitle('🗑️ All Cases Voided')
        .addFields(
          { name: '➜ User', value: `${user.tag} (<@${user.id}>)`, inline: true },
          { name: '➜ Cases Voided', value: `${voidedCount}`, inline: true }
        )
        .setFooter({ text: `Timestamp: ${timestamp.toUTCString()}` });

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      await interaction.reply({ content: `✅ Voided ${voidedCount} case(s) for ${user.tag}.`, ephemeral: false });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ An error occurred while voiding cases.', ephemeral: true });
    }
  },
};
