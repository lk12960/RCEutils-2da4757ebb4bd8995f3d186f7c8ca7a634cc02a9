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
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option.setName('target').setDescription('User to kick').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for kick').setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('senddm')
        .setDescription('Send a DM to the user about the kick?')
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

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    try { await (require('../../utils/stats').track)('kick', 1, interaction.guild?.id, { user: target.id }); } catch {}
    if (!member || !member.kickable) {
      return interaction.reply({ content: '❌ I cannot kick this user.', ephemeral: true });
    }

    // Send DM to the user if sendDm is true
    if (sendDm) {
      try {
        await target.send(`You have been kicked from King's Customs for: ${reason}`);
      } catch (error) {
        console.error('Failed to send DM:', error);
        await interaction.followUp({
          content: `⚠️ Could not send DM to ${target.tag}. They may have DMs disabled.`,
          ephemeral: true,
        });
      }
    }

    await member.kick(reason);

    const caseId = await createCase(interaction.guild.id, target.id, interaction.user.id, 'Kick', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('👢 Member Kicked')
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
      content: `👢 Kicked **${target.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}${sendDm ? '\n📩 DM sent to user' : ''}`,
      ephemeral: false,
    });
  },
};