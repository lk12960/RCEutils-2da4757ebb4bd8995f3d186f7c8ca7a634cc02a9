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
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('User ID or mention of the person to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for unbanning')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('senddm')
        .setDescription('Send a DM to the user about the unban?')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    let userInput = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const sendDm = interaction.options.getBoolean('senddm') ?? false;

    // Extract user ID from mention or use as-is
    // Discord mentions are in format <@123456789> or <@!123456789>
    const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
    const userId = mentionMatch ? mentionMatch[1] : userInput;

    let banInfo;
    try {
      banInfo = await interaction.guild.bans.fetch(userId);
    } catch {
      return interaction.reply({
        content: `❌ No ban found for user ID **${userId}**.`,
        ephemeral: true,
      });
    }

    try {
      await interaction.guild.bans.remove(userId, reason);
    } catch (error) {
      console.error('Failed to unban:', error);
      return interaction.reply({
        content: '❌ Failed to unban the user. Do I have the correct permissions?',
        ephemeral: true,
      });
    }

    // Send DM to the user if sendDm is true
    let dmFailed = false;
    if (sendDm) {
      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send(`You have been unbanned from King's Customs.`);
      } catch (error) {
        console.error('Failed to send DM:', error);
        dmFailed = true;
      }
    }

    const caseId = await createCase(userId, interaction.user.id, 'Unban', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ User Unbanned')
      .addFields(
        { name: '➜ User', value: `${banInfo.user.tag} (<@${userId}>)`, inline: false },
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
      content: `✅ Successfully unbanned **${banInfo.user.tag}** (ID: ${userId})\\n🆔 Case #${caseId}${sendDm ? (dmFailed ? '\\n⚠️ Could not send DM (user may have DMs disabled)' : '\\n📩 DM sent to user') : ''}`,
      ephemeral: false,
    });
  },
};