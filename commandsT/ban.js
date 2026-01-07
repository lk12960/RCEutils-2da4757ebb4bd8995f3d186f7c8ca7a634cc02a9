const { EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'ban',
  description: 'Ban a user from the server.',
  usage: '>ban @user [reason]',

  async execute(message, args) {
    // Permission check
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('❌ Please mention a user to ban. Usage: `>ban @user [reason]`');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    // Attempt to ban user
    try {
      await message.guild.bans.create(user.id, { reason });
    } catch (error) {
      console.error('Ban failed:', error);
      return message.reply('❌ I could not ban this user. Do I have the correct permissions?');
    }

    const caseId = await createCase(user.id, message.author.id, 'Ban', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⛔ User Banned')
      .addFields(
        { name: '➜ User', value: `${user.tag} (<@${user.id}>)`, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel?.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    message.reply(`🔨 Banned **${user.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}`);
  },
};