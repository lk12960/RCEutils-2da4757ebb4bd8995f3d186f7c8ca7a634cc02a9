const { EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'unban',
  description: 'Unban a user from the server',
  usage: '<userID> [reason]',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const userId = args[0];
    if (!userId) {
      return message.reply('❌ Please provide a user ID to unban.');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    let banInfo;
    try {
      banInfo = await message.guild.bans.fetch(userId);
    } catch {
      return message.reply(`❌ No ban found for user ID **${userId}**.`);
    }

    try {
      await message.guild.bans.remove(userId, reason);
    } catch (error) {
      console.error('Failed to unban:', error);
      return message.reply('❌ Failed to unban the user. Do I have the correct permissions?');
    }

    const caseId = await createCase(userId, message.author.id, 'Unban', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ User Unbanned')
      .addFields(
        { name: '➜ User', value: `${banInfo.user.tag} (<@${userId}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await message.reply(`✅ Successfully unbanned **${banInfo.user.tag}** (ID: ${userId})\n🆔 Case #${caseId}`);
  },
};
