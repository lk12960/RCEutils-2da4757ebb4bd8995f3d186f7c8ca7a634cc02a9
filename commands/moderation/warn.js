const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { createCase } = require('../../utils/caseManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');
const { isModerator } = require('../../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user and log it as a case')
    .addUserOption(option =>
      option.setName('target').setDescription('User to warn').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for warning').setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('senddm')
        .setDescription('Send a DM to the user about the warning?')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const sendDm = interaction.options.getBoolean('senddm') ?? false;

    // Send DM to the user if sendDm is true
    try { await (require('../../utils/stats').track)('warn', 1, interaction.guild?.id, { user: target.id }); } catch {}
    if (sendDm) {
      try {
        await target.send(`You have been warned in King's Customs for: ${reason}`);
      } catch (error) {
        console.error('Failed to send DM:', error);
        await interaction.followUp({
          content: `⚠️ Could not send DM to ${target.tag}. They may have DMs disabled.`,
          ephemeral: true,
        });
      }
    }

    const caseId = await createCase(interaction.guild.id, target.id, interaction.user.id, 'Warn', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR_HEX)
      .setTitle('⚠️ Member Warned')
      .addFields(
        { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ DM Sent', value: sendDm ? 'Yes' : 'No', inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await interaction.reply({
      content: `⚠️ Warned **${target.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}${sendDm ? '\n📩 DM sent to user' : ''}`,
      ephemeral: false,
    });
  },
};