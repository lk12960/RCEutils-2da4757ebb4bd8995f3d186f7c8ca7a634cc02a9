const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getCaseById, voidCase } = require('../../utils/caseManager');
const { isManagement } = require('../../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('void')
    .setDescription('Mark a moderation case as voided')
    .addIntegerOption(option =>
      option.setName('id').setDescription('Case ID to void').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const caseId = interaction.options.getInteger('id');
    const modCase = await getCaseById(caseId);

    if (!modCase) {
      return interaction.reply({ content: `❌ Case #${caseId} not found.`, ephemeral: true });
    }

    if (modCase.voided) {
      return interaction.reply({ content: `⚠️ Case #${caseId} is already voided.`, ephemeral: true });
    }

    const success = await voidCase(caseId);
    if (success) { try { await (require('../../utils/stats').track)('moderation_voided', 1, interaction.guild?.id, { caseId }); } catch {} }
    if (!success) {
      return interaction.reply({ content: `❌ Failed to void Case #${caseId}.`, ephemeral: true });
    }

    const timestamp = new Date();
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('🔁 Case Voided')
      .addFields(
        { name: '➜ Case ID', value: `#${modCase.id}`, inline: true },
        { name: '➜ Type', value: modCase.action, inline: true },
        { name: '➜ User', value: `<@${modCase.user_id}>`, inline: true },
        { name: '➜ Reason', value: modCase.reason || 'No reason', inline: false },
        { name: '➜ Original Date', value: `<t:${Math.floor(new Date(modCase.timestamp).getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Voided at ${timestamp.toUTCString()}` });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await interaction.reply({ content: `✅ Case #${caseId} has been voided.`, ephemeral: false });
  },
};
