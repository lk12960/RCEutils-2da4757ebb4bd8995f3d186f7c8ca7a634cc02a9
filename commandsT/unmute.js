const { EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'unmute',
  description: "Remove a user's mute (timeout)",

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const targetId = args[0];
    if (!targetId) {
      return message.reply('❌ Please provide the ID of the user to unmute.');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const member = await message.guild.members.fetch(targetId).catch(() => null);
    if (!member) {
      return message.reply('❌ User not found in this server.');
    }

    if (!member.communicationDisabledUntil) {
      return message.reply('❌ This user is not currently muted.');
    }

    try {
      await member.timeout(null, reason);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Failed to unmute the user.');
    }

    const caseId = await createCase(targetId, message.author.id, 'Unmute', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f) // yellow
      .setTitle('🔈 Member Unmuted')
      .addFields(
        { name: '➜ User', value: `${member.user.tag} (<@${targetId}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    return message.channel.send(`🔈 **${member.user.tag}** has been unmuted.\n🆔 Case #${caseId}`);
  },
};