const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const ms = require('ms');
const { createCase } = require('../../utils/caseManager');
const { BRAND_COLOR_HEX, BRAND_NAME } = require('../../utils/branding');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Temporarily mute a user using Discord timeout')
    .addUserOption(option =>
      option.setName('target').setDescription('User to mute').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Mute duration (e.g., 10m, 1h, 1d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for mute').setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('senddm')
        .setDescription('Send a DM to the user about the mute?')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const { requireTier } = require('../../utils/permissions');
    if (!requireTier(interaction.member, 'moderator')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
    const target = interaction.options.getUser('target');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const sendDm = interaction.options.getBoolean('senddm') ?? false;

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 5000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Invalid duration. Must be between 5 seconds and 28 days.',
        ephemeral: true,
      });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    try { await (require('../../utils/stats').track)('mute', 1, interaction.guild?.id, { user: target.id }); } catch {}
    if (!member || !member.moderatable) {
      return interaction.reply({ content: '❌ I cannot mute this user.', ephemeral: true });
    }

    // Send DM to the user if sendDm is true
    if (sendDm) {
      try {
        await target.send(`You have been muted in King's Customs for: ${reason} (Duration: ${durationInput})`);
      } catch (error) {
        console.error('Failed to send DM:', error);
        await interaction.followUp({
          content: `⚠️ Could not send DM to ${target.tag}. They may have DMs disabled.`,
          ephemeral: true,
        });
      }
    }

    await member.timeout(durationMs, reason);

    const caseId = await createCase(target.id, interaction.user.id, 'Mute', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR_HEX)
      .setTitle('🔇 Member Muted')
      .addFields(
        { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: '➜ Duration', value: durationInput, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ DM Sent', value: sendDm ? 'Yes' : 'No', inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await interaction.reply({
      content: `🔇 Muted **${target.tag}** for **${durationInput}**\n�ID Case #${caseId}\n📄 Reason: ${reason}${sendDm ? '\n📩 DM sent to user' : ''}`,
      ephemeral: false,
    });
  },
};