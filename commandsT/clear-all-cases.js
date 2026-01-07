const { EmbedBuilder } = require('discord.js');
const { voidAllCasesForUser } = require('../utils/caseManager');
const { isManagement } = require('../utils/permissions');

const LOG_CHANNEL_ID = '1411411537494806709';

module.exports = {
  name: 'clearallcases',
  description: 'Void all moderation cases for a user.',
  usage: '>clearallcases @user',

  async execute(message, args) {
    // Permission check
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('❌ You must mention a user. Usage: `>clearallcases @user`');
    }

    try {
      const voidedCount = await voidAllCasesForUser(user.id);

      if (voidedCount === 0) {
        return message.reply(`⚠️ No active cases found for ${user.tag}.`);
      }

      const timestamp = new Date();
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🗑️ All Cases Voided')
        .addFields(
          { name: '➜ User', value: `${user.tag} (<@${user.id}>)`, inline: true },
          { name: '➜ Cases Voided', value: `${voidedCount}`, inline: true }
        )
        .setFooter({ text: `Timestamp: ${timestamp.toUTCString()}` });

      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      return message.reply(`✅ Voided ${voidedCount} case(s) for ${user.tag}.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ An error occurred while voiding cases.');
    }
  },
};