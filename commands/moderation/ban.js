const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { createCase } = require('../../utils/caseManager');
const { isModerator } = require('../../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option.setName('target').setDescription('User to ban').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for ban').setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('senddm')
        .setDescription('Send a DM to the user about the ban?')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    // Check permissions
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const sendDm = interaction.options.getBoolean('senddm') ?? false; // Default to false if not specified

    // Attempt to ban the user
    try { await (require('../../utils/stats').track)('ban', 1, interaction.guild?.id, { user: target.id }); } catch {}
    try {
      await interaction.guild.bans.create(target.id, { reason });
    } catch (error) {
      console.error('Ban failed:', error);
      return interaction.reply({
        content: '❌ I could not ban this user. Do I have the correct permissions?',
        ephemeral: true,
      });
    }

    // Send DM to the user if sendDm is true
    if (sendDm) {
      try {
        await target.send(`You have been banned from King's Customs for: ${reason}`);
      } catch (error) {
        console.error('Failed to send DM:', error);
        // Optionally notify the moderator that DM failed
        await interaction.followUp({
          content: `⚠️ Could not send DM to ${target.tag}. They may have DMs disabled.`,
          ephemeral: true,
        });
      }
    }

    const caseId = await createCase(target.id, interaction.user.id, 'Ban', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⛔ User Banned')
      .addFields(
        { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ DM Sent', value: sendDm ? 'Yes' : 'No', inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel?.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await interaction.reply({
      content: `🔨 Banned **${target.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}${sendDm ? '\n📩 DM sent to user' : ''}`,
      ephemeral: false,
    });
  },
};